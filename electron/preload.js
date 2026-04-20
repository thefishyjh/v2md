const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Video processing
  processVideo: (url, options) => ipcRenderer.invoke('video:process', url, options),
  cancelProcess: () => ipcRenderer.invoke('video:cancel'),

  // Progress
  onProgress: (callback) => ipcRenderer.on('video:progress', (_, data) => callback(data)),

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  // Dialogs
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters),

  // Shell
  openFolder: (path) => ipcRenderer.invoke('shell:openPath', path),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),
});
