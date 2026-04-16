import ytdlp from 'yt-dlp';
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
  return new Promise((resolve, reject) => {
    ytdlp.exec(url, {
      dumpSingleJson: true,
      noCheckCertificate: true,
    }, (err, output) => {
      if (err) {
        reject(new Error(`获取视频信息失败: ${err.message}`));
        return;
      }
      try {
        const info = JSON.parse(output[1]);
        resolve({
          id: info.id || extractVideoId(url),
          title: info.title || '未知标题',
          uploader: info.uploader || info.channel || info.username || '未知UP主',
          duration: info.duration || 0,
          uploadDate: info.upload_date || '',
          thumbnail: info.thumbnail || '',
          description: info.description || '',
          webpageUrl: info.webpage_url || url,
          videoPath: '', // Will be set later if needed
        });
      } catch (e) {
        reject(new Error(`解析视频信息失败: ${e.message}`));
      }
    });
  });
}

async function downloadSubtitle(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'subtitle.%(ext)s');

  return new Promise((resolve, reject) => {
    ytdlp.exec(url, {
      writeSub: true,
      writeAutoSub: true,
      subLang: 'zh-Hans,zh-cn,zh,en,ai-zh,ai-en',
      subFormat: 'srt',
      noCheckCertificate: true,
      output: outputTemplate,
    }, async (err, output) => {
      if (err) {
        // No subtitle available - not a fatal error
        console.log('  警告: 无法下载字幕，将仅使用视频信息生成笔记');
        resolve(null);
        return;
      }

      // Find the downloaded subtitle file
      try {
        const files = await fs.readdir(tempDir);
        const subtitleFile = files.find(f => f.startsWith('subtitle.') && f.endsWith('.srt'));
        if (subtitleFile) {
          resolve(path.join(tempDir, subtitleFile));
        } else {
          console.log('  警告: 字幕文件未找到');
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  });
}

async function downloadVideo(url, tempDir, videoId) {
  const outputTemplate = path.join(tempDir, 'video.%(ext)s');

  return new Promise((resolve, reject) => {
    ytdlp.exec(url, {
      format: 'bestvideo[ext=mp4]/best[ext=mp4]/best',
      output: outputTemplate,
      noCheckCertificate: true,
    }, async (err, output) => {
      if (err) {
        console.log('  警告: 无法下载视频，将跳过截屏');
        resolve(null);
        return;
      }

      // Find the downloaded video file
      try {
        const files = await fs.readdir(tempDir);
        const videoFile = files.find(f => f.startsWith('video.'));
        if (videoFile) {
          resolve(path.join(tempDir, videoFile));
        } else {
          console.log('  警告: 视频文件未找到');
          resolve(null);
        }
      } catch (e) {
        resolve(null);
      }
    });
  });
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
