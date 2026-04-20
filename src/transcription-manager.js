import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

const TRANSCRIPTION_CACHE_DIR = path.join(os.homedir(), '.v2md', 'transcriptions');

export async function getTranscription(videoPath, videoId, whisperPath = '') {
  // Check cache first
  const cachePath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.json`);
  if (await fileExists(cachePath)) {
    const cached = await fs.readFile(cachePath, 'utf-8');
    return JSON.parse(cached);
  }

  // Determine whisper command
  const whisperCmd = whisperPath || 'whisper';
  const outputPath = path.join(TRANSCRIPTION_CACHE_DIR, videoId);

  try {
    await fs.mkdir(TRANSCRIPTION_CACHE_DIR, { recursive: true });

    // Run whisper.cpp for transcription
    // whisper.cpp usage: whisper -m model.bin -f audio.mp3 -osrt -of output
    const cmd = `${whisperCmd} -m model.bin -f "${videoPath}" -osrt -of "${outputPath}" --language zh`;
    await execAsync(cmd, { timeout: 600000 }); // 10 min timeout

    // Read generated SRT file
    const srtPath = `${outputPath}.srt`;
    if (await fileExists(srtPath)) {
      const srtContent = await fs.readFile(srtPath, 'utf-8');
      const transcription = parseSRT(srtContent);

      // Cache the result
      await fs.writeFile(cachePath, JSON.stringify(transcription), 'utf-8');

      return transcription;
    }

    return null;
  } catch (e) {
    console.error('Whisper transcription failed:', e.message);
    return null;
  }
}

function parseSRT(content) {
  const lines = content.split('\n');
  const segments = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();

    // Sequence number
    if (/^\d+$/.test(trimmed)) {
      if (current) segments.push(current);
      current = { text: '' };
    }
    // Timestamp line - skip
    else if (/^\d{2}:\d{2}:\d{2}/.test(trimmed)) {
      // do nothing
    }
    // Empty line
    else if (trimmed === '') {
      if (current && current.text) {
        segments.push(current);
        current = null;
      }
    }
    // Text content
    else if (current) {
      current.text += (current.text ? ' ' : '') + trimmed;
    }
  }

  if (current && current.text) {
    segments.push(current);
  }

  return segments;
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
  const srtPath = path.join(TRANSCRIPTION_CACHE_DIR, `${videoId}.srt`);

  try {
    if (await fileExists(cachePath)) await fs.unlink(cachePath);
    if (await fileExists(srtPath)) await fs.unlink(srtPath);
  } catch (e) {
    console.error('Failed to clear cache:', e.message);
  }
}