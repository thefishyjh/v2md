import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getTranscription } from './transcription-manager.js';

const execAsync = promisify(exec);

export async function videoFetcher(url, options = {}) {
  const { cookiePath, whisperPath = '', onProgress } = options;
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2md-'));

  // Step 1: Get metadata
  onProgress?.({ step: 1, message: '获取视频信息...' });
  const metadata = await getMetadata(url, tempDir, cookiePath);

  let subtitlePath = null;
  let transcription = null;

  // Step 2: Try to download subtitle, if fails use Whisper
  onProgress?.({ step: 2, message: '检查字幕...' });
  subtitlePath = await downloadSubtitle(url, tempDir, metadata.id, cookiePath);

  if (!subtitlePath) {
    // No subtitle - need to use Whisper for transcription
    onProgress?.({ step: 2, message: '无字幕，使用 Whisper 转写...' });

    // Download video first
    onProgress?.({ step: 2, message: '下载视频用于转写...' });
    const videoPath = await downloadVideo(url, tempDir, metadata.id, cookiePath);

    if (videoPath) {
      metadata.videoPath = videoPath;
      // Use Whisper to transcribe
      transcription = await getTranscription(videoPath, metadata.id, whisperPath);
    }
  }

  // Step 3: Download video for screenshots
  if (!metadata.videoPath) {
    onProgress?.({ step: 3, message: '下载视频用于截图...' });
    metadata.videoPath = await downloadVideo(url, tempDir, metadata.id);
  }

  return { metadata, subtitlePath, transcription };
}

async function getMetadata(url, tempDir, cookiePath) {
  const outputFile = path.join(tempDir, 'metadata.json');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --dump-json --no-playlist "${url}" > "${outputFile}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --dump-json --no-playlist --cookies "${cookiePath}" "${url}" > "${outputFile}" 2>NUL`;
    }
    await execAsync(cmd);
    const content = await fs.readFile(outputFile, 'utf-8');
    const info = JSON.parse(content);

    return {
      id: info.id || extractVideoId(url),
      title: info.title || 'Unknown Title',
      uploader: info.uploader || info.channel || info.username || 'Unknown UP',
      duration: info.duration || 0,
      uploadDate: info.upload_date || '',
      thumbnail: info.thumbnail || '',
      description: info.description || '',
      webpageUrl: info.webpage_url || url,
      videoPath: '',
      hasSubtitle: !!(info.subtitles && Object.keys(info.subtitles).length > 0),
    };
  } catch (e) {
    throw new Error(`Failed to fetch metadata: ${e.message}`);
  }
}

async function downloadSubtitle(url, tempDir, videoId, cookiePath) {
  const outputTemplate = path.join(tempDir, 'subtitle.%(ext)s');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --write-sub --write-auto-sub --sub-lang zh-Hans,zh-CN,zh,en --sub-format srt --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp --write-sub --write-auto-sub --sub-lang zh-Hans,zh-CN,zh,en --sub-format srt --no-playlist --cookies "${cookiePath}" -o "${outputTemplate}" "${url}" 2>NUL`;
    }
    await execAsync(cmd);

    // Find the downloaded subtitle file
    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(f => f.startsWith('subtitle.') && f.endsWith('.srt'));
    if (subtitleFile) {
      return path.join(tempDir, subtitleFile);
    }
    return null;
  } catch (e) {
    console.log('  Warning: Cannot download subtitles');
    return null;
  }
}

async function downloadVideo(url, tempDir, videoId, cookiePath) {
  const outputTemplate = path.join(tempDir, 'video.%(ext)s');

  try {
    let cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp -f "bestvideo[ext=mp4]/best[ext=mp4]/best" --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`;
    if (cookiePath) {
      cmd = `set PYTHONHTTPSVERIFY=0 && yt-dlp -f "bestvideo[ext=mp4]/best[ext=mp4]/best" --no-playlist --cookies "${cookiePath}" -o "${outputTemplate}" "${url}" 2>NUL`;
    }
    await execAsync(cmd);

    // Find the downloaded video file
    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.startsWith('video.'));
    if (videoFile) {
      return path.join(tempDir, videoFile);
    }
    return null;
  } catch (e) {
    console.log('  Warning: Cannot download video');
    return null;
  }
}

function extractVideoId(url) {
  // Extract BV ID from bilibili URL
  const bvMatch = url.match(/BV[a-zA-Z0-9]+/);
  if (bvMatch) return bvMatch[0];

  // Extract av ID
  const avMatch = url.match(/av(\d+)/);
  if (avMatch) return `av${avMatch[1]}`;

  // Use hash of URL as fallback
  return url.replace(/[^a-zA-Z0-9]/g, '').substring(0, 16);
}
