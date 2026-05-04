import fs from 'fs/promises';
import { MinimaxProvider } from '../electron/backend/ai/minimax.js';
import { AnthropicProvider } from '../electron/backend/ai/anthropic.js';
import { DeepSeekProvider } from '../electron/backend/ai/deepseek.js';
import { createLocalStore } from './store/localConfigStore.js';

const store = createLocalStore();
const SEGMENT_WINDOW_SECONDS = 180;
const MIN_SEGMENT_CHARS = 260;

export async function keypointAnalyzer(subtitlePath, numPoints = 8, transcription = null, options = {}) {
  if (!subtitlePath && !transcription) {
    console.log('  No subtitle or transcription, skipping keypoint analysis');
    return [];
  }

  const timeline = await buildTimelineEntries(subtitlePath, transcription);
  const fullText = timeline.map((x) => x.text).join('\n').trim();
  if (!fullText) {
    console.log('  Content is empty, skipping analysis');
    return [];
  }

  console.log(`  Content length: ${fullText.length} chars`);

  const settings = options.settings || store.get('settings', {});
  const model = options.model || 'minimax';
  assertModelReady(model, settings);

  if (model === 'minimax') {
    const result = await analyzeWithMinimax(fullText, timeline, numPoints, settings);
    return ensureNonEmptyKeypoints(result, fullText);
  }

  const provider = createProvider(model, settings);
  if (!provider) {
    console.log(`  Unknown model '${model}', fallback to minimax`);
    const result = await analyzeWithMinimax(fullText, timeline, numPoints, settings);
    return ensureNonEmptyKeypoints(result, fullText);
  }

  try {
    const result = await provider.generate(fullText, numPoints);
    return ensureNonEmptyKeypoints(normalizeKeypoints(result).slice(0, numPoints), fullText);
  } catch (e) {
    console.error(`  ${model} analysis failed:`, e.message);
    return ensureNonEmptyKeypoints([], fullText);
  }
}

function assertModelReady(model, settings) {
  const config = settings || {};
  if (model === 'anthropic' && !config.anthropicApiKey) {
    throw new Error('未配置 Claude API Key，请先在设置中填写');
  }
  if (model === 'minimax' && !config.minimaxApiKey) {
    throw new Error('未配置 Minimax API Key，请先在设置中填写');
  }
  if (model === 'deepseek' && !config.deepseekApiKey) {
    throw new Error('未配置 DeepSeek API Key，请先在设置中填写');
  }
}

function createProvider(model, settings) {
  if (model === 'anthropic' && settings.anthropicApiKey) {
    return new AnthropicProvider(settings.anthropicApiKey);
  }
  if (model === 'deepseek' && settings.deepseekApiKey) {
    return new DeepSeekProvider(settings.deepseekApiKey);
  }
  if (model === 'minimax' && settings.minimaxApiKey) {
    return new MinimaxProvider(
      settings.minimaxApiKey,
      settings.minimaxBaseUrl || 'https://api.minimax.io',
      settings.minimaxModel || 'MiniMax-M2.7'
    );
  }
  return null;
}

async function analyzeWithMinimax(fullText, timeline, numPoints, settings) {
  const minimax = new MinimaxProvider(
    settings.minimaxApiKey || '',
    settings.minimaxBaseUrl || 'https://api.minimax.io',
    settings.minimaxModel || 'MiniMax-M2.7'
  );

  const segments = splitTimelineSegments(timeline, SEGMENT_WINDOW_SECONDS);
  console.log(`  Split into ${segments.length} segments`);
  const quotas = allocateSegmentQuotas(segments, numPoints);

  const candidates = [];
  let authError = null;
  for (let i = 0; i < segments.length; i += 1) {
    const seg = segments[i];
    const targetPoints = quotas[i];
    if (targetPoints <= 0) continue;

    console.log(`  Analyzing segment ${i + 1}/${segments.length}...`);
    try {
      const segmentKeypoints = await minimax.analyzeSegment({
        segmentText: seg.text,
        startTime: Math.floor(seg.startTime),
        endTime: Math.ceil(seg.endTime),
        targetPoints,
        densityHint: seg.density >= 5 ? 'high' : seg.density >= 2.5 ? 'medium' : 'low',
        segmentIndex: i + 1,
        totalSegments: segments.length,
      });
      candidates.push(...segmentKeypoints);
    } catch (e) {
      console.error(`  Segment ${i + 1} analysis failed:`, e.message);
      if (String(e.message || '').toLowerCase().includes('invalid api key')) {
        authError = e;
      }
    }
  }

  if (authError) {
    throw new Error('MiniMax API Key 无效，请在设置中更新后重试');
  }

  const normalizedCandidates = deduplicateKeypoints(normalizeKeypoints(candidates));
  console.log(`  Total keypoints after dedup: ${normalizedCandidates.length}`);

  if (normalizedCandidates.length === 0) return [];

  const consolidated = await minimax.consolidateKeypoints(fullText, normalizedCandidates, numPoints);
  const normalizedConsolidated = deduplicateKeypoints(normalizeKeypoints(consolidated));
  if (normalizedConsolidated.length > 0) {
    return normalizedConsolidated.slice(0, numPoints);
  }

  return normalizedCandidates.slice(0, numPoints);
}

function splitTimelineSegments(entries, windowSeconds) {
  if (!Array.isArray(entries) || entries.length === 0) return [];

  const segments = [];
  let current = {
    startTime: toNumber(entries[0].start),
    endTime: toNumber(entries[0].end),
    lines: [],
    chars: 0,
  };

  for (const entry of entries) {
    const text = String(entry.text || '').trim();
    if (!text) continue;
    const start = toNumber(entry.start);
    const end = Math.max(start, toNumber(entry.end));
    const duration = Math.max(0.1, end - start);

    const wouldExceedTime = start - current.startTime > windowSeconds;
    const wouldExceedChars = current.chars >= 3200;

    if (current.lines.length > 0 && (wouldExceedTime || wouldExceedChars)) {
      const built = buildSegmentFromCurrent(current);
      if (built) segments.push(built);
      current = { startTime: start, endTime: end, lines: [], chars: 0 };
    }

    current.lines.push(text);
    current.endTime = Math.max(current.endTime, end);
    current.chars += text.length;

    if (duration > windowSeconds && text.length > MIN_SEGMENT_CHARS && current.lines.length === 1) {
      const built = buildSegmentFromCurrent(current);
      if (built) segments.push(built);
      current = { startTime: end, endTime: end, lines: [], chars: 0 };
    }
  }

  const tail = buildSegmentFromCurrent(current);
  if (tail) segments.push(tail);
  return segments;
}

function buildSegmentFromCurrent(current) {
  const text = current.lines.join('\n').trim();
  if (!text) return null;
  const duration = Math.max(1, current.endTime - current.startTime);
  return {
    text,
    startTime: current.startTime,
    endTime: current.endTime,
    chars: text.length,
    density: text.length / duration,
  };
}

function allocateSegmentQuotas(segments, numPoints) {
  if (!segments.length) return [];
  const totalChars = segments.reduce((sum, seg) => sum + Math.max(1, seg.chars), 0);

  const base = segments.map((seg) => Math.max(0, Math.round((numPoints * seg.chars) / totalChars)));
  const highDensityIndices = segments
    .map((seg, i) => ({ i, density: seg.density }))
    .sort((a, b) => b.density - a.density)
    .slice(0, Math.max(1, Math.floor(segments.length / 3)))
    .map((x) => x.i);

  for (const i of highDensityIndices) {
    base[i] += 1;
  }

  for (let i = 0; i < segments.length; i += 1) {
    if (segments[i].chars >= 400 && base[i] === 0) base[i] = 1;
  }

  const sum = base.reduce((a, b) => a + b, 0);
  if (sum === numPoints) return base;

  if (sum > numPoints) {
    let overflow = sum - numPoints;
    const order = [...base.keys()].sort((a, b) => base[b] - base[a]);
    for (const idx of order) {
      while (base[idx] > 1 && overflow > 0) {
        base[idx] -= 1;
        overflow -= 1;
      }
      if (overflow <= 0) break;
    }
    for (const idx of order) {
      while (base[idx] > 0 && overflow > 0) {
        base[idx] -= 1;
        overflow -= 1;
      }
      if (overflow <= 0) break;
    }
    return base;
  }

  let deficit = numPoints - sum;
  const order = [...base.keys()].sort((a, b) => segments[b].density - segments[a].density);
  while (deficit > 0) {
    for (const idx of order) {
      base[idx] += 1;
      deficit -= 1;
      if (deficit <= 0) break;
    }
  }
  return base;
}

async function buildTimelineEntries(subtitlePath, transcription) {
  if (subtitlePath) {
    const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
    const parsed = parseSrtWithTime(subtitleContent);
    if (parsed.length > 0) return parsed;
    return [{ start: 0, end: estimateDurationByText(subtitleContent), text: parseSubtitlePlain(subtitleContent) }];
  }

  if (Array.isArray(transcription)) {
    return transcription
      .map((seg) => ({
        start: toNumber(seg.start),
        end: Math.max(toNumber(seg.start), toNumber(seg.end)),
        text: String(seg.text || '').trim(),
      }))
      .filter((x) => x.text);
  }

  return [];
}

function parseSrtWithTime(content) {
  const lines = String(content || '').split(/\r?\n/);
  const entries = [];
  let i = 0;

  while (i < lines.length) {
    const indexLine = lines[i].trim();
    if (/^\d+$/.test(indexLine) && i + 1 < lines.length) {
      const timeLine = lines[i + 1].trim();
      const match = timeLine.match(
        /^(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})\s*-->\s*(\d{2}):(\d{2}):(\d{2})[,.](\d{1,3})$/
      );

      if (match) {
        const start = hmsToSeconds(match[1], match[2], match[3], match[4]);
        const end = hmsToSeconds(match[5], match[6], match[7], match[8]);
        const textLines = [];
        i += 2;
        while (i < lines.length && lines[i].trim() !== '') {
          textLines.push(lines[i].trim());
          i += 1;
        }
        const text = textLines.join(' ').trim();
        if (text) entries.push({ start, end, text });
      } else {
        i += 1;
      }
    } else {
      i += 1;
    }
  }

  return entries;
}

function parseSubtitlePlain(content) {
  const lines = String(content || '').split(/\r?\n/);
  const textLines = [];
  let inSubtitle = false;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      inSubtitle = true;
      currentText = [];
    } else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // skip timestamp
    } else if (trimmed === '') {
      if (inSubtitle && currentText.length > 0) {
        textLines.push(currentText.join(' ').trim());
      }
      inSubtitle = false;
    } else if (inSubtitle) {
      currentText.push(trimmed);
    }
  }
  return textLines.join('\n');
}

function estimateDurationByText(text) {
  const chars = String(text || '').length;
  return Math.max(60, Math.floor(chars / 5));
}

function hmsToSeconds(h, m, s, ms) {
  return Number(h) * 3600 + Number(m) * 60 + Number(s) + Number(ms) / 1000;
}

function deduplicateKeypoints(keypoints) {
  const seen = new Map();
  for (const kp of keypoints) {
    if (!kp.title) continue;
    const normalizedTitle = kp.title.toLowerCase().replace(/\s+/g, '');
    const normalizedTime = normalizeTime(kp.time) || '0:00';
    const key = `${normalizedTitle}|${normalizedTime}`;
    if (!seen.has(key)) {
      seen.set(key, kp);
    }
  }
  return Array.from(seen.values()).sort((a, b) => timeToSeconds(a.time) - timeToSeconds(b.time));
}

function normalizeKeypoints(keypoints) {
  if (!Array.isArray(keypoints)) return [];
  return keypoints
    .map((kp) => {
      const title = String(kp.title || '').trim();
      const description = String(kp.description || kp.evidence || '').trim();
      const time = normalizeTime(kp.time);
      if (!title || !time || !description) return null;
      return { ...kp, title, description, time };
    })
    .filter(Boolean);
}

function normalizeTime(raw) {
  if (raw == null) return null;
  const value = String(raw).trim();

  if (/^\d+$/.test(value)) return secondsToMMSS(Number(value));
  if (/^\d{1,2}:\d{2}$/.test(value)) {
    const [m, s] = value.split(':').map(Number);
    return secondsToMMSS(m * 60 + s);
  }
  if (/^\d{1,2}:\d{2}:\d{2}$/.test(value)) {
    const [h, m, s] = value.split(':').map(Number);
    return secondsToMMSS(h * 3600 + m * 60 + s);
  }
  return null;
}

function secondsToMMSS(totalSeconds) {
  const safe = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function timeToSeconds(mmss) {
  const t = normalizeTime(mmss) || '0:00';
  const [m, s] = t.split(':').map(Number);
  return m * 60 + s;
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function ensureNonEmptyKeypoints(keypoints, fullText) {
  if (Array.isArray(keypoints) && keypoints.length > 0) {
    return keypoints;
  }

  const text = String(fullText || '').trim();
  if (!text) return [];

  const condensed = text.replace(/\s+/g, ' ').trim();
  const shortTitle = condensed.slice(0, 18) || '视频摘要';
  const description = condensed.length > 280 ? `${condensed.slice(0, 280)}...` : condensed;
  return [
    {
      time: '0:00',
      title: `内容摘要: ${shortTitle}`,
      description,
    },
  ];
}
