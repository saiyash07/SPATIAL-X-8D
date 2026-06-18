const { contextBridge, ipcRenderer } = require('electron');

// Expose minimal safe APIs to renderer if needed
contextBridge.exposeInMainWorld('electronAPI', {
  platform: process.platform,
  isElectron: true,
  getStreamUrl: (videoId) => ipcRenderer.invoke('get-stream-url', videoId),
});
