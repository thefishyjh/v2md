import { execFile } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { getTranscription } from './transcription-manager.js';

const execFileAsync = promisify(execFile);
const BILI_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';

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

    // Download audio first for transcription (video streams may have no audio track)
    onProgress?.({ step: 2, message: '下载音频用于转写...' });
    const audioPath = await downloadAudio(url, tempDir, cookiePath);
    if (audioPath) {
      // Use Whisper to transcribe
      transcription = await getTranscription(audioPath, metadata.id, whisperPath);
    } else {
      onProgress?.({ step: 2, message: '音频下载失败，尝试下载带音轨视频转写...' });
      const transcribeVideoPath = await downloadTranscribeVideo(url, tempDir, cookiePath);
      if (transcribeVideoPath) {
        transcription = await getTranscription(transcribeVideoPath, metadata.id, whisperPath);
      }
    }

    const hasTranscription = Array.isArray(transcription) && transcription.length > 0;
    if (!hasTranscription) {
      throw new Error('Failed to get subtitle/transcription. Check Bilibili cookie, yt-dlp access, and whisper.cpp setup.');
    }

    // Pre-download video for screenshots
    onProgress?.({ step: 3, message: '下载视频用于截图...' });
    metadata.videoPath = await downloadVideo(url, tempDir, metadata.id, cookiePath);
  }

  // Step 3: Download video for screenshots
  if (!metadata.videoPath) {
    onProgress?.({ step: 3, message: '下载视频用于截图...' });
    metadata.videoPath = await downloadVideo(url, tempDir, metadata.id, cookiePath);
  }

  return { metadata, subtitlePath, transcription };
}

async function getMetadata(url, tempDir, cookiePath) {
  const outputFile = path.join(tempDir, 'metadata.json');

  try {
    const args = ['--dump-json', '--no-playlist'];
    applyBiliHeaders(args, url);
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push(url);
    const { stdout } = await runYtDlp(args);
    await fs.writeFile(outputFile, stdout, 'utf-8');
    const info = JSON.parse(stdout);

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
    throw new Error(`Failed to fetch metadata: ${extractCmdError(e)}`);
  }
}

async function downloadSubtitle(url, tempDir, videoId, cookiePath) {
  const outputTemplate = path.join(tempDir, 'subtitle.%(ext)s');

  try {
    const args = [
      '--write-sub',
      '--write-auto-sub',
      '--sub-lang', 'zh-Hans,zh-CN,zh,en',
      '--sub-format', 'srt',
      '--no-playlist',
    ];
    applyBiliHeaders(args, url);
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push('-o', outputTemplate, url);
    await runYtDlp(args);

    // Find the downloaded subtitle file
    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(f => f.startsWith('subtitle.') && f.endsWith('.srt'));
    if (subtitleFile) {
      return path.join(tempDir, subtitleFile);
    }
    return null;
  } catch (e) {
    console.log(`  Warning: Cannot download subtitles (${extractCmdError(e)})`);
    return null;
  }
}

async function downloadVideo(url, tempDir, videoId, cookiePath) {
  const outputTemplate = path.join(tempDir, 'video.%(ext)s');

  try {
    const args = ['-f', 'bestvideo[ext=mp4]/best[ext=mp4]/best', '--no-playlist'];
    applyBiliHeaders(args, url);
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push('-o', outputTemplate, url);
    await runYtDlp(args);

    // Find the downloaded video file
    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.startsWith('video.'));
    if (videoFile) {
      return path.join(tempDir, videoFile);
    }
    return null;
  } catch (e) {
    console.log(`  Warning: Cannot download video (${extractCmdError(e)})`);
    return null;
  }
}

async function downloadAudio(url, tempDir, cookiePath) {
  const outputTemplate = path.join(tempDir, 'audio.%(ext)s');

  try {
    const args = ['-f', 'bestaudio[ext=m4a]/bestaudio/best', '--no-playlist'];
    applyBiliHeaders(args, url);
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push('-o', outputTemplate, url);
    await runYtDlp(args);

    const files = await fs.readdir(tempDir);
    const audioFile = files.find((f) => f.startsWith('audio.'));
    if (audioFile) {
      return path.join(tempDir, audioFile);
    }
    return null;
  } catch (e) {
    console.log(`  Warning: Cannot download audio (${extractCmdError(e)})`);
    return null;
  }
}

async function downloadTranscribeVideo(url, tempDir, cookiePath) {
  const outputTemplate = path.join(tempDir, 'transcribe-video.%(ext)s');

  try {
    const args = ['-f', 'best[ext=mp4]/best', '--no-playlist'];
    applyBiliHeaders(args, url);
    if (cookiePath) {
      args.push('--cookies', cookiePath);
    }
    args.push('-o', outputTemplate, url);
    await runYtDlp(args);

    const files = await fs.readdir(tempDir);
    const videoFile = files.find((f) => f.startsWith('transcribe-video.'));
    if (videoFile) {
      return path.join(tempDir, videoFile);
    }
    return null;
  } catch (e) {
    console.log(`  Warning: Cannot download transcribe video (${extractCmdError(e)})`);
    return null;
  }
}

async function runYtDlp(args) {
  return execFileAsync('yt-dlp', args, {
    env: { ...process.env, PYTHONHTTPSVERIFY: '0' },
    maxBuffer: 20 * 1024 * 1024,
  });
}

function extractCmdError(error) {
  if (!error) return 'Unknown error';
  const stderr = String(error.stderr || '').trim();
  const stdout = String(error.stdout || '').trim();
  const message = String(error.message || '').trim();
  return stderr || stdout || message || 'Command failed';
}

function applyBiliHeaders(args, url) {
  const input = String(url || '');
  if (!input.includes('bilibili.com') && !input.includes('b23.tv')) {
    return;
  }
  args.push('--add-header', 'Referer:https://www.bilibili.com/');
  args.push('--add-header', 'Origin:https://www.bilibili.com');
  args.push('--add-header', `User-Agent:${BILI_USER_AGENT}`);
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

