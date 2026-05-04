import { ipcMain, shell, dialog } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import { pathToFileURL } from 'url';
import { aiService } from './ai/index.js';
import { videoFetcher } from '../../src/video-fetcher.js';
import { keypointAnalyzer } from '../../src/keypoint-analyzer.js';
import { screenshotExtractor } from '../../src/screenshot-extractor.js';
import { markdownGenerator } from '../../src/markdown-generator.js';
import { clearCookie, getCookiePath, saveCookie } from './cookie-manager.js';
import { createLocalStore } from '../../src/store/localConfigStore.js';
import { MinimaxProvider } from './ai/minimax.js';

const store = createLocalStore();
aiService.init(store.get('settings', {}));
let isCanceled = false;

function toAbsolutePath(targetPath) {
  if (!targetPath) return '';
  return path.isAbsolute(targetPath)
    ? targetPath
    : path.resolve(process.cwd(), targetPath);
}

function normalizeNote(note) {
  if (!note || typeof note !== 'object') return note;

  const filePath = toAbsolutePath(note.filePath);
  const outputPath = toAbsolutePath(note.outputPath);
  const screenshots = Array.isArray(note.screenshots)
    ? note.screenshots.map(toAbsolutePath).filter(Boolean)
    : [];

  return {
    ...note,
    filePath,
    outputPath,
    screenshots,
    screenshotUrls: screenshots.map((s) => pathToFileURL(s).href),
  };
}

// IPC: Select directory
ipcMain.handle('dialog:selectDirectory', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory'],
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Select file
ipcMain.handle('dialog:selectFile', async (_, filters) => {
  let normalizedFilters = [{ name: 'All Files', extensions: ['*'] }];
  if (Array.isArray(filters) && filters.length > 0) {
    normalizedFilters = typeof filters[0] === 'string'
      ? [{ name: 'Selected Files', extensions: filters }]
      : filters;
  }

  const result = await dialog.showOpenDialog({
    properties: ['openFile'],
    filters: normalizedFilters,
  });
  return result.canceled ? null : result.filePaths[0];
});

// IPC: Open folder
ipcMain.handle('shell:openPath', (_, targetPath) => {
  shell.openPath(targetPath);
});

// IPC: Get settings
ipcMain.handle('settings:get', () => store.get('settings', {}));

// IPC: Save settings
ipcMain.handle('settings:save', (_, settings) => {
  store.set('settings', settings);
  aiService.init(settings);

  if (settings.bilibiliCookie) {
    saveCookie(settings.bilibiliCookie);
  } else {
    clearCookie();
  }

  return true;
});

// IPC: Validate Minimax API Key
ipcMain.handle('settings:validateMinimaxKey', async (_, payload = {}) => {
  const saved = store.get('settings', {});
  const apiKey = String(payload.apiKey || saved.minimaxApiKey || '').trim();
  const baseUrl = String(payload.baseUrl || saved.minimaxBaseUrl || 'https://api.minimax.io').trim();
  const model = String(payload.model || saved.minimaxModel || 'MiniMax-M2.7').trim();

  if (!apiKey) {
    return { success: false, error: '请先输入 Minimax API Key' };
  }

  try {
    const provider = new MinimaxProvider(apiKey, baseUrl, model);
    await provider.requestChatCompletion([{ role: 'user', content: '请仅返回 JSON: {"ok":true}' }], 0);
    return { success: true, message: 'Minimax API Key 验证通过' };
  } catch (e) {
    const msg = String(e?.message || '验证失败');
    return { success: false, error: msg };
  }
});

// IPC: Cancel current task
ipcMain.handle('video:cancel', () => {
  isCanceled = true;
  return true;
});

// IPC: History
ipcMain.handle('history:get', () => store.get('history', []).map(normalizeNote));
ipcMain.handle('history:delete', (_, id) => {
  const history = store.get('history', []);
  const next = history.filter((item) => item.id !== id);
  store.set('history', next);
  return true;
});

// IPC: Read generated Markdown note
ipcMain.handle('note:read', async (_, filePath) => {
  const resolvedFilePath = toAbsolutePath(filePath);
  const content = await fs.readFile(resolvedFilePath, 'utf-8');
  const baseDir = path.dirname(resolvedFilePath);

  return {
    content,
    filePath: resolvedFilePath,
    baseDir,
    assetBaseUrl: pathToFileURL(`${baseDir}${path.sep}`).href,
  };
});

function assertNotCanceled() {
  if (isCanceled) {
    throw new Error('任务已取消');
  }
}

function formatDuration(seconds) {
  if (!seconds || Number.isNaN(Number(seconds))) return '未知';
  const s = Math.floor(Number(seconds));
  const hours = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  if (hours > 0) {
    return `${hours}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

// IPC: Process video
ipcMain.handle('video:process', async (event, url, options) => {
  console.log('[video:process] start', { url });
  const settings = store.get('settings', {});
  const {
    numPoints = 8,
    model = 'minimax',
    outputDir = settings.outputDir || './output',
  } = options || {};

  const cookiePath = getCookiePath();
  isCanceled = false;

  try {
    event.sender.send('video:progress', { step: 1, message: '获取视频信息...' });
    const { metadata, subtitlePath, transcription } = await videoFetcher(url, {
      cookiePath,
      whisperPath: settings.whisperPath,
      onProgress: (p) => event.sender.send('video:progress', p),
    });
    assertNotCanceled();

    event.sender.send('video:progress', { step: 2, message: '分析关键内容点...' });
    const keypoints = await keypointAnalyzer(subtitlePath, numPoints, transcription, { model, settings });
    assertNotCanceled();

    event.sender.send('video:progress', { step: 3, message: '截取关键帧...' });
    const screenshots = await screenshotExtractor(metadata.videoPath, keypoints, outputDir);
    assertNotCanceled();

    event.sender.send('video:progress', { step: 4, message: '生成笔记...' });
    const outputPath = await markdownGenerator(metadata, keypoints, screenshots, outputDir, {
      subtitlePath,
      transcription,
    });
    assertNotCanceled();

    const history = store.get('history', []);
    const savedScreenshots = [];
    for (let i = 0; i < screenshots.length; i += 1) {
      if (screenshots[i]) {
        savedScreenshots.push(path.join(outputPath, 'screenshots', `screenshot-${i + 1}.png`));
      }
    }

    const note = {
      id: `${metadata.id}-${Date.now()}`,
      title: metadata.title,
      uploader: metadata.uploader,
      duration: formatDuration(metadata.duration),
      createdAt: new Date().toISOString(),
      screenshotCount: savedScreenshots.length,
      filePath: path.join(outputPath, 'notes.md'),
      keypoints,
      screenshots: savedScreenshots,
      outputPath,
    };

    store.set('history', [note, ...history].slice(0, 200));

    return { success: true, outputPath, metadata, keypoints, note: normalizeNote(note) };
  } catch (error) {
    return { success: false, error: error.message };
  } finally {
    isCanceled = false;
  }
});

// closable object used by server.close()
const serverMock = {
  close: () => {},
};

export function startServer() {
  return serverMock;
}
