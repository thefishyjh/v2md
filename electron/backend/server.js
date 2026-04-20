import { ipcMain, shell } from 'electron';
import Store from 'electron-store';
import { aiService } from './ai/index.js';
import { videoFetcher } from '../../src/video-fetcher.js';
import { keypointAnalyzer } from '../../src/keypoint-analyzer.js';
import { screenshotExtractor } from '../../src/screenshot-extractor.js';
import { markdownGenerator } from '../../src/markdown-generator.js';
import { getCookiePath, saveCookie } from './cookie-manager.js';

const store = new Store();

// IPC: Select directory
ipcMain.handle('dialog:selectDirectory', async () => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Select file
ipcMain.handle('dialog:selectFile', async (_, filters) => {
  const { dialog } = require('electron');
  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: filters || [{ name: 'All Files', extensions: ['*'] }]
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Open folder
ipcMain.handle('shell:openPath', (_, path) => {
  shell.openPath(path);
});

// IPC: Get settings
ipcMain.handle('settings:get', () => store.get('settings', {}));

// IPC: Save settings
ipcMain.handle('settings:save', (_, settings) => {
  store.set('settings', settings);
  aiService.init(settings);

  // Save Bilibili cookie if provided
  if (settings.bilibiliCookie) {
    saveCookie(settings.bilibiliCookie);
  }

  return true;
});

// IPC: Process video
ipcMain.handle('video:process', async (event, url, options) => {
  const { numPoints = 8, model = 'minimax', outputDir = './output' } = options;
  const cookiePath = getCookiePath();
  const settings = store.get('settings', {});

  try {
    // Step 1: Get metadata, subtitle, transcription
    event.sender.send('video:progress', { step: 1, message: '获取视频信息...' });
    const { metadata, subtitlePath, transcription } = await videoFetcher(url, {
      cookiePath,
      whisperPath: settings.whisperPath,
      onProgress: (p) => event.sender.send('video:progress', p)
    });

    // Step 2: Analyze keypoints (segment-based)
    event.sender.send('video:progress', { step: 2, message: '分析关键内容点...' });
    const keypoints = await keypointAnalyzer(subtitlePath, numPoints, transcription);

    // Step 3: Extract screenshots
    event.sender.send('video:progress', { step: 3, message: '截取关键帧...' });
    const screenshots = await screenshotExtractor(metadata.videoPath, keypoints, outputDir);

    // Step 4: Generate Markdown
    event.sender.send('video:progress', { step: 4, message: '生成笔记...' });
    const outputPath = await markdownGenerator(metadata, keypoints, screenshots, outputDir);

    return { success: true, outputPath, metadata, keypoints };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// 可关闭的空对象用于 server.close()
const serverMock = {
  close: () => {}
};

export function startServer() {
  return serverMock;
}
