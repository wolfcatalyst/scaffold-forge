const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  isElectron: true,
  platform: process.platform,
  pickFolder: (defaultPath) => ipcRenderer.invoke("pick-folder", defaultPath),
  openFolder: (folder) => ipcRenderer.invoke("open-folder", folder),
});
