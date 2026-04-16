import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

export async function videoFetcher(url) {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'v2md-'));

  // Step 1: Get metadata
  console.log('  获取视频元数据...');
  const metadata = await getMetadata(url, tempDir);

  // Step 2: Download subtitle
  console.log('  下载字幕...');
  const subtitlePath = await downloadSubtitle(url, tempDir, metadata.id);

  // Step 3: Download video for screenshots
  console.log('  下载视频（用于截屏）...');
  const videoPath = await downloadVideo(url, tempDir, metadata.id);
  metadata.videoPath = videoPath;

  return { metadata, subtitlePath };
}

async function getMetadata(url, tempDir) {
  const outputFile = path.join(tempDir, 'metadata.json');

  try {
    await execAsync(`yt-dlp --dump-json --no-playlist "${url}" > "${outputFile}" 2>NUL`);
    const content = await fs.readFile(outputFile, 'utf-8');
    const info = JSON.parse(content);

    return {
      id: info.id || extractVideoId(url),
      title: info.title || '未知标题',
      uploader: info.uploader || info.channel || info.username || '未知UP主',
      duration: info.duration || 0,
      uploadDate: info.upload_date || '',
      thumbnail: info.thumbnail || '',
      description: info.description || '',
      webpageUrl: info.webpage_url || url,
      videoPath: '',
    };
  } catch (e) {
    throw new Error(`获取视频信息失败: ${e.message}`);
  }
}

async function downloadSubtitle(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'subtitle.%(ext)s');

  try {
    await execAsync(`yt-dlp --write-sub --write-auto-sub --sub-lang zh-Hans,zh-cn,zh,en,ai-zh,ai-en --sub-format srt --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`);

    // Find the downloaded subtitle file
    const files = await fs.readdir(tempDir);
    const subtitleFile = files.find(f => f.startsWith('subtitle.') && f.endsWith('.srt'));
    if (subtitleFile) {
      return path.join(tempDir, subtitleFile);
    }
    return null;
  } catch (e) {
    console.log('  警告: 无法下载字幕，将仅使用视频信息生成笔记');
    return null;
  }
}

async function downloadVideo(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'video.%(ext)s');

  try {
    await execAsync(`yt-dlp -f "bestvideo[ext=mp4]/best[ext=mp4]/best" --no-playlist -o "${outputTemplate}" "${url}" 2>NUL`);

    // Find the downloaded video file
    const files = await fs.readdir(tempDir);
    const videoFile = files.find(f => f.startsWith('video.'));
    if (videoFile) {
      return path.join(tempDir, videoFile);
    }
    return null;
  } catch (e) {
    console.log('  警告: 无法下载视频，将跳过截屏');
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
