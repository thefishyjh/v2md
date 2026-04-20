import Anthropic from '@anthropic-ai/sdk';
import { MinimaxProvider } from '../electron/backend/ai/minimax.js';
import Store from 'electron-store';
import fs from 'fs/promises';

const execAsync = promisify(exec);
const store = new Store();
const anthropic = new Anthropic();

// Segment length in minutes
const SEGMENT_LENGTH_MINUTES = 5;

export async function keypointAnalyzer(subtitlePath, numPoints = 8, transcription = null) {
  // If no subtitle AND no transcription, skip analysis
  if (!subtitlePath && !transcription) {
    console.log('  No subtitle or transcription, skipping keypoint analysis');
    return [];
  }

  // Get text content
  let fullText = '';
  if (subtitlePath) {
    const subtitleContent = await fs.readFile(subtitlePath, 'utf-8');
    fullText = parseSubtitle(subtitleContent);
  } else if (transcription) {
    fullText = transcription.map(s => s.text).join('\n');
  }

  if (!fullText.trim()) {
    console.log('  Content is empty, skipping analysis');
    return [];
  }

  console.log(`  Content length: ${fullText.length} chars`);

  // Initialize MiniMax provider
  const minimax = new MinimaxProvider(
    store.get('settings', {}).minimaxApiKey || '',
    store.get('settings', {}).minimaxBaseUrl || 'https://api.minimax.chat'
  );

  // Split into segments for analysis
  const segments = splitIntoSegments(fullText, SEGMENT_LENGTH_MINUTES);
  console.log(`  Split into ${segments.length} segments`);

  // Analyze each segment and collect all keypoints
  const allKeypoints = [];
  for (let i = 0; i < segments.length; i++) {
    console.log(`  Analyzing segment ${i + 1}/${segments.length}...`);

    try {
      const segmentKeypoints = await minimax.analyzeSegment(
        segments[i].text,
        segments[i].startTime,
        Math.max(3, Math.floor(numPoints / segments.length) + 1)
      );
      allKeypoints.push(...segmentKeypoints);
    } catch (e) {
      console.error(`  Segment ${i + 1} analysis failed:`, e.message);
    }
  }

  // Deduplicate and merge keypoints
  const deduplicated = deduplicateKeypoints(allKeypoints);
  console.log(`  Total keypoints after dedup: ${deduplicated.length}`);

  return deduplicated;
}

function splitIntoSegments(text, segmentMinutes) {
  // Estimate time per character (average speech rate)
  const charsPerMinute = 300;
  const charsPerSegment = charsPerMinute * segmentMinutes;

  const segments = [];
  const lines = text.split('\n');
  let currentSegment = { text: '', startTime: 0 };
  let currentCharCount = 0;
  let segmentStartTime = 0;

  for (const line of lines) {
    currentSegment.text += (currentSegment.text ? '\n' : '') + line;
    currentCharCount += line.length;

    if (currentCharCount >= charsPerSegment) {
      currentSegment.endTime = segmentStartTime + segmentMinutes * 60;
      segments.push(currentSegment);
      segmentStartTime = currentSegment.endTime;
      currentSegment = { text: '', startTime: segmentStartTime };
      currentCharCount = 0;
    }
  }

  if (currentSegment.text) {
    segments.push(currentSegment);
  }

  return segments;
}

function deduplicateKeypoints(keypoints) {
  const seen = new Map();
  for (const kp of keypoints) {
    const key = kp.title.toLowerCase().trim();
    if (!seen.has(key)) {
      seen.set(key, kp);
    }
  }
  return Array.from(seen.values());
}

function parseSubtitle(content) {
  const lines = content.split('\n');
  const textLines = [];
  let inSubtitle = false;
  let currentText = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (/^\d+$/.test(trimmed)) {
      inSubtitle = true;
      currentText = [];
    }
    else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // do nothing, skip timestamp
    }
    else if (trimmed === '') {
      if (inSubtitle && currentText.length > 0) {
        textLines.push(currentText.join(' ').trim());
      }
      inSubtitle = false;
    }
    else if (inSubtitle) {
      currentText.push(trimmed);
    }
  }
  return textLines.join('\n');
}