const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('printstack', {
  getAppInfo: () => ipcRenderer.invoke('app:info'),
  window: {
    minimize: () => ipcRenderer.invoke('window:minimize'),
    maximize: () => ipcRenderer.invoke('window:maximize'),
    close: () => ipcRenderer.invoke('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:isMaximized'),
    onMaximized: (callback) => {
      const listener = (_event, value) => callback(value)
      ipcRenderer.on('window:maximized', listener)
      return () => ipcRenderer.removeListener('window:maximized', listener)
    },
  },
  location: {
    current: () => ipcRenderer.invoke('location:current'),
  },
  printers: {
    list: () => ipcRenderer.invoke('printers:list'),
    testPrint: (payload) => ipcRenderer.invoke('printers:testPrint', payload),
    onJobStatus: (callback) => {
      const listener = (_event, payload) => callback(payload)
      ipcRenderer.on('printers:jobStatus', listener)
      return () => ipcRenderer.removeListener('printers:jobStatus', listener)
    },
  },
})
