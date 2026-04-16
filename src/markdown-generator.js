import fs from 'fs/promises';
import path from 'path';

export async function markdownGenerator(metadata, keypoints, screenshotPaths, outputDir) {
  // Format duration
  const durationStr = formatDuration(metadata.duration);

  // Build markdown content
  let content = '';

  // Header
  content += `# ${metadata.title}\n\n`;

  // Metadata section
  content += `## 视频信息\n\n`;
  content += `- **UP主**: ${metadata.uploader}\n`;
  content += `- **时长**: ${durationStr}\n`;
  content += `- **链接**: [${metadata.webpageUrl}](${metadata.webpageUrl})\n`;
  if (metadata.uploadDate) {
    content += `- **发布日期**: ${formatDate(metadata.uploadDate)}\n`;
  }

  content += '\n';

  // Key points section
  content += `## 关键内容点\n\n`;

  if (keypoints.length === 0) {
    content += `_暂无关键内容点（可能视频无字幕）_\n`;
  } else {
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      const screenshot = screenshotPaths[i];

      content += `### [${kp.time}] ${kp.title}\n\n`;
      content += `${kp.description}\n\n`;

      if (screenshot) {
        const relativePath = path.relative(outputDir, screenshot);
        content += `![截图](${relativePath.replace(/\\/g, '/')})\n\n`;
      }
    }
  }

  // Write to file
  const safeTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  const outputPath = path.join(outputDir, `${safeTitle}.md`);

  await fs.writeFile(outputPath, content, 'utf-8');

  return outputPath;
}

function formatDuration(seconds) {
  if (!seconds) return '未知';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function formatDate(dateStr) {
  if (!dateStr || dateStr.length !== 8) return dateStr;
  return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
}
