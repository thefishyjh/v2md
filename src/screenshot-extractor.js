import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

export async function screenshotExtractor(videoPath, keypoints, outputDir, timeOffset = '0') {
  const screenshots = [];

  if (!videoPath) {
    console.log('  跳过截屏（无视频文件）');
    return screenshots;
  }

  try {
    await execAsync('ffmpeg -version');
  } catch (e) {
    console.log('  警告: ffmpeg 未安装，跳过截屏');
    return screenshots;
  }

  const screenshotsDir = path.join(outputDir, 'screenshots');
  await fs.mkdir(screenshotsDir, { recursive: true });

  const offsetSeconds = parseTimeOffset(timeOffset);

  for (let i = 0; i < keypoints.length; i++) {
    const keypoint = keypoints[i];
    const timestamp = keypoint.time;
    const screenshotPath = path.join(screenshotsDir, `screenshot-${i + 1}.png`);

    console.log(`  截取关键点 ${i + 1}/${keypoints.length}: [${timestamp}] ${keypoint.title}`);

    try {
      const baseSeconds = parseTimestampToSeconds(timestamp);
      if (baseSeconds == null) {
        console.log(`    警告: 无法识别的时间戳 ${timestamp}`);
        screenshots.push(null);
        continue;
      }

      const targetSeconds = Math.max(0, baseSeconds + offsetSeconds);
      const targetTime = formatTimeForFFmpeg(targetSeconds);

      await execAsync(
        `ffmpeg -ss "${targetTime}" -i "${videoPath}" -vframes 1 -q:v 2 "${screenshotPath}" -y`,
        { timeout: 30000 }
      );

      const stats = await fs.stat(screenshotPath);
      if (stats.size > 0) {
        screenshots.push(screenshotPath);
        console.log(`    完成: ${screenshotPath}`);
      } else {
        console.log('    警告: 截屏文件为空');
        screenshots.push(null);
      }
    } catch (e) {
      console.log(`    错误: ${e.message}`);
      screenshots.push(null);
    }
  }

  return screenshots;
}

function parseTimestampToSeconds(timestamp) {
  if (timestamp == null) return null;
  const text = String(timestamp).trim();

  if (/^\d+$/.test(text)) {
    return Number(text);
  }

  if (/^\d{1,2}:\d{2}$/.test(text)) {
    const [mins, secs] = text.split(':').map(Number);
    return mins * 60 + secs;
  }

  if (/^\d{1,2}:\d{2}:\d{2}$/.test(text)) {
    const [hours, mins, secs] = text.split(':').map(Number);
    return hours * 3600 + mins * 60 + secs;
  }

  return null;
}

function parseTimeOffset(offset) {
  if (!offset || offset === '0') return 0;

  if (offset.startsWith('+')) {
    const num = parseFloat(offset.substring(1));
    if (offset.endsWith('s')) {
      return num;
    }
    if (offset.endsWith('m')) {
      return num * 60;
    }
    return num;
  }

  if (offset.startsWith('-')) {
    const num = parseFloat(offset.substring(1));
    if (offset.endsWith('s')) {
      return -num;
    }
    if (offset.endsWith('m')) {
      return -num * 60;
    }
    return -num;
  }

  return 0;
}

function formatTimeForFFmpeg(totalSeconds) {
  const hours = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = Math.floor(totalSeconds % 60);
  const ms = Math.floor((totalSeconds % 1) * 1000);

  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}
