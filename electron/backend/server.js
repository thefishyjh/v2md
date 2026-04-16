import express from 'express';
import { ipcMain } from 'electron';
import Store from 'electron-store';
import { aiService } from './ai/index.js';
import { videoFetcher } from '../../src/video-fetcher.js';
import { screenshotExtractor } from '../../src/screenshot-extractor.js';
import { markdownGenerator } from '../../src/markdown-generator.js';

const store = new Store();
const app = express();
app.use(express.json());

let currentProcess = null;

export function startServer() {
  // 初始化 AI 服务
  aiService.init(store.get('settings', {}));

  // IPC: 获取设置
  ipcMain.handle('settings:get', () => store.get('settings', {}));

  // IPC: 保存设置
  ipcMain.handle('settings:save', (_, settings) => {
    store.set('settings', settings);
    aiService.init(settings);
    return true;
  });

  // IPC: 处理视频
  ipcMain.handle('video:process', async (event, url, options) => {
    const { numPoints = 8, model = 'anthropic', outputDir = './output' } = options;

    try {
      // 1. 获取视频信息 + 字幕
      event.sender.send('video:progress', { step: 1, message: '获取视频信息...' });
      const { metadata, subtitlePath } = await videoFetcher(url);

      // 2. AI 分析关键点
      event.sender.send('video:progress', { step: 2, message: '分析关键内容点...' });
      const { keypoints } = await aiService.analyze(subtitlePath, numPoints, model);

      // 3. 截取关键帧
      event.sender.send('video:progress', { step: 3, message: '截取关键帧...' });
      const screenshots = await screenshotExtractor(metadata.videoPath, keypoints, outputDir);

      // 4. 生成 Markdown
      event.sender.send('video:progress', { step: 4, message: '生成笔记...' });
      const outputPath = await markdownGenerator(metadata, keypoints, screenshots, outputDir);

      return { success: true, outputPath, metadata, keypoints };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  return app;
}