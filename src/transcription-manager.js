import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

const execFileAsync = promisify(execFile);

const TRANSCRIPTION_CACHE_DIR = path.join(process.cwd(), '.appdata', 'transcriptions');

export async function getTranscription(videoPath, videoId, whisperPath = '') {
  const cachePath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.json`);
  if (await fileExists(cachePath)) {
    const cached = await fs.readFile(cachePath, 'utf-8');
    const parsed = JSON.parse(cached);
    if (!isLikelyCorruptedTranscription(parsed)) {
      return parsed;
    }
    await fs.unlink(cachePath).catch(() => {});
  }

  try {
    await fs.mkdir(TRANSCRIPTION_CACHE_DIR, { recursive: true });
    const whisperBin = await resolveWhisperBinary(whisperPath);
    const modelPath = await resolveWhisperModel(whisperBin);
    const tmpBase = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}-${Date.now()}`);
    const wavPath = `${tmpBase}.wav`;
    const outputBase = `${tmpBase}-whisper`;

    console.log(`Running whisper.cpp transcription on ${videoId}...`);
    await runCommand('ffmpeg', ['-y', '-i', videoPath, '-vn', '-ac', '1', '-ar', '16000', wavPath], 180000);
    await runCommand(
      whisperBin,
      ['-m', modelPath, '-f', wavPath, '-l', 'zh', '-oj', '-of', outputBase],
      600000
    );

    const transcription = await loadWhisperCppResult(outputBase);
    await fs.unlink(wavPath).catch(() => {});
    await fs.unlink(`${outputBase}.json`).catch(() => {});
    await fs.unlink(`${outputBase}.txt`).catch(() => {});

    if (transcription && transcription.length > 0) {
      await fs.writeFile(cachePath, JSON.stringify(transcription), 'utf-8');
      console.log(`Transcription completed: ${transcription.length} segments`);
      return transcription;
    }

    return null;
  } catch (e) {
    console.error('Whisper.cpp transcription failed:', e.message);
    if (e.stderr) console.error('stderr:', e.stderr);
    return null;
  }
}

async function resolveWhisperBinary(customPath) {
  const candidates = [];
  const custom = String(customPath || '').trim();
  const cwd = process.cwd();

  if (custom) {
    candidates.push(custom);
  }

  candidates.push(path.join(cwd, 'whisper.cpp', 'build', 'bin', 'whisper-cli.exe'));
  candidates.push(path.join(cwd, 'whisper.cpp', 'whisper-cli.exe'));
  candidates.push(path.join(cwd, 'whisper-cli.exe'));
  candidates.push(path.join(cwd, 'bin', 'whisper-cli.exe'));

  for (const p of candidates) {
    if (p && fsSync.existsSync(p)) return p;
  }

  try {
    const { stdout } = await execFileAsync('where.exe', ['whisper-cli']);
    const lines = String(stdout || '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    if (lines.length > 0 && fsSync.existsSync(lines[0])) {
      return lines[0];
    }
  } catch {
    // ignore lookup failures
  }

  throw new Error('未找到 whisper.cpp 可执行文件（whisper-cli.exe）。请放到项目内 whisper.cpp/build/bin/ 下，或在设置里指定路径。');
}

function isLikelyCorruptedTranscription(transcription) {
  if (!Array.isArray(transcription) || transcription.length === 0) return false;
  const allText = transcription.map((seg) => String(seg?.text || '')).join('');
  return allText.includes('\uFFFD');
}

async function resolveWhisperModel(whisperBin) {
  const cwd = process.cwd();
  const envModel = String(process.env.V2MD_WHISPER_MODEL || '').trim();
  const binDir = path.dirname(whisperBin);

  const candidates = [
    envModel,
    path.join(cwd, 'whisper.cpp', 'models', 'ggml-small.bin'),
    path.join(cwd, 'models', 'ggml-small.bin'),
    path.resolve(binDir, '..', 'models', 'ggml-small.bin'),
    path.join(binDir, 'models', 'ggml-small.bin'),
  ].filter(Boolean);

  for (const p of candidates) {
    if (fsSync.existsSync(p)) return p;
  }

  throw new Error('未找到 whisper.cpp 模型文件（ggml-small.bin）。请放到 whisper.cpp/models/ 下，或设置 V2MD_WHISPER_MODEL。');
}

async function runCommand(command, args, timeout) {
  try {
    return await execFileAsync(command, args, {
      timeout,
      maxBuffer: 20 * 1024 * 1024,
      windowsHide: true,
    });
  } catch (e) {
    const detail = String(e.stderr || e.stdout || e.message || '').trim();
    throw new Error(`${command} 执行失败: ${detail}`);
  }
}

async function loadWhisperCppResult(outputBase) {
  const jsonPath = `${outputBase}.json`;
  const txtPath = `${outputBase}.txt`;

  if (await fileExists(jsonPath)) {
    const raw = await fs.readFile(jsonPath, 'utf-8');
    const data = JSON.parse(raw);
    return normalizeWhisperCppSegments(data);
  }

  if (await fileExists(txtPath)) {
    const text = (await fs.readFile(txtPath, 'utf-8')).trim();
    if (!text) return [];
    return [{ text, start: 0, end: 0 }];
  }

  throw new Error('whisper.cpp 未生成转写输出文件');
}

function normalizeWhisperCppSegments(payload) {
  if (Array.isArray(payload)) {
    return payload.map(normalizeSegment).filter(Boolean);
  }

  if (Array.isArray(payload?.segments)) {
    return payload.segments.map(normalizeSegment).filter(Boolean);
  }

  if (Array.isArray(payload?.transcription)) {
    return payload.transcription
      .map((seg) => normalizeSegment({
        text: seg?.text,
        start: normalizeOffset(seg?.offsets?.from),
        end: normalizeOffset(seg?.offsets?.to),
      }))
      .filter(Boolean);
  }

  return [];
}

function normalizeSegment(seg) {
  const text = String(seg?.text || '').trim();
  if (!text) return null;
  const start = normalizeOffset(seg?.start ?? seg?.from ?? seg?.t0);
  const end = normalizeOffset(seg?.end ?? seg?.to ?? seg?.t1);
  return { text, start, end: end >= start ? end : start };
}

function normalizeOffset(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  if (n > 3600 * 24) return n / 1000;
  if (n > 1000) return n / 1000;
  return n;
}

async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function clearTranscriptionCache(videoId) {
  const cachePath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.json`);

  try {
    if (await fileExists(cachePath)) await fs.unlink(cachePath);
  } catch (e) {
    console.error('Failed to clear cache:', e.message);
  }
}
