const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // 视频处理
  processVideo: (url, options) => ipcRenderer.invoke('video:process', url, options),
  cancelProcess: () => ipcRenderer.invoke('video:cancel'),

  // 进度监听
  onProgress: (callback) => ipcRenderer.on('video:progress', (_, data) => callback(data)),

  // 设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // 历史
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
});
