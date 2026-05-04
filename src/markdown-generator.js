import fs from 'fs/promises';
import path from 'path';

export async function markdownGenerator(
  metadata,
  keypoints,
  screenshotPaths,
  outputDir,
  extras = {}
) {
  // Create organized directory structure
  const safeTitle = metadata.title.replace(/[<>:"/\\|?*]/g, '_').substring(0, 100);
  const videoDir = path.join(outputDir, safeTitle);
  const screenshotsDir = path.join(videoDir, 'screenshots');

  await fs.mkdir(videoDir, { recursive: true });
  await fs.mkdir(screenshotsDir, { recursive: true });

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
  content += `- **知识点数量**: ${keypoints.length}\n`;

  content += '\n';

  // Key points section
  content += `## 关键内容点\n\n`;

  if (keypoints.length === 0) {
    content += `_暂无关键内容点_\n`;
  } else {
    for (let i = 0; i < keypoints.length; i++) {
      const kp = keypoints[i];
      content += `### [${kp.time}] ${kp.title}\n\n`;
      content += `${kp.description || ''}\n\n`;

      // Screenshot reference (if available)
      const screenshotFile = `screenshot-${i + 1}.png`;
      const screenshotPath = path.join(screenshotsDir, screenshotFile);
      if (screenshotPaths && screenshotPaths[i]) {
        try {
          await fs.copyFile(screenshotPaths[i], screenshotPath);
          content += `![截图](screenshots/${screenshotFile})\n\n`;
        } catch (e) {
          // Screenshot copy failed, skip
        }
      }
    }
  }

  // Write markdown file
  const mdPath = path.join(videoDir, 'notes.md');
  await fs.writeFile(mdPath, content, 'utf-8');

  // Save metadata as JSON
  const metadataPath = path.join(videoDir, 'metadata.json');
  await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2), 'utf-8');

  // Save keypoints as JSON
  const keypointsPath = path.join(videoDir, 'keypoints.json');
  await fs.writeFile(keypointsPath, JSON.stringify(keypoints, null, 2), 'utf-8');

  if (Array.isArray(extras.transcription) && extras.transcription.length > 0) {
    const transcriptionPath = path.join(videoDir, 'transcription.json');
    await fs.writeFile(transcriptionPath, JSON.stringify(extras.transcription, null, 2), 'utf-8');
  }

  if (extras.subtitlePath) {
    const subtitleDir = path.join(videoDir, 'subtitles');
    await fs.mkdir(subtitleDir, { recursive: true });

    const ext = path.extname(extras.subtitlePath) || '.srt';
    const subtitleOutputPath = path.join(subtitleDir, `subtitle${ext}`);
    try {
      await fs.copyFile(extras.subtitlePath, subtitleOutputPath);
    } catch (e) {
      // Subtitle copy failed, keep main output available
    }
  }

  return videoDir;
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
