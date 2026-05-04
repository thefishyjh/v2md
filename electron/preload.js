const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  // Video processing
  processVideo: (url, options) => ipcRenderer.invoke('video:process', url, options),
  cancelProcess: () => ipcRenderer.invoke('video:cancel'),

  // Progress
  onProgress: (callback) => {
    const listener = (_, data) => callback(data);
    ipcRenderer.on('video:progress', listener);
    return () => ipcRenderer.removeListener('video:progress', listener);
  },

  // Settings
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),
  validateMinimaxKey: (payload) => ipcRenderer.invoke('settings:validateMinimaxKey', payload),

  // Dialogs
  selectDirectory: () => ipcRenderer.invoke('dialog:selectDirectory'),
  selectFile: (filters) => ipcRenderer.invoke('dialog:selectFile', filters),

  // Shell
  openFolder: (path) => ipcRenderer.invoke('shell:openPath', path),

  // History
  getHistory: () => ipcRenderer.invoke('history:get'),
  deleteHistory: (id) => ipcRenderer.invoke('history:delete', id),

  // Notes
  readNote: (filePath) => ipcRenderer.invoke('note:read', filePath),
});
