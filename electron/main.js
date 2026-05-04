import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { startServer } from './backend/server.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// 写入日志文件
const logFile = path.join(process.cwd(), 'v2md.log');
function log(...args) {
  const msg = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${msg}\n`;
  fs.appendFileSync(logFile, line);
  console.log(...args);
}

let mainWindow;
let server;

async function createWindow() {
  log('Starting v2md application...');
  log('Log file:', logFile);

  // 启动后端服务
  server = await startServer();
  log('Backend server started');

  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // 开发模式加载 Vite Dev Server
  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:5173');
    mainWindow.webContents.openDevTools();
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  log('Window created, loading content...');
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  log('Window closed, quitting...');
  if (server) server.close();
  app.quit();
});
