const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  detectSession:  ()           => ipcRenderer.invoke('detect-session'),
  getStats:       (id, cwd)    => ipcRenderer.invoke('get-stats', id, cwd),
  loadSessions:   ()           => ipcRenderer.invoke('load-sessions'),
  saveSession:    (payload)    => ipcRenderer.invoke('save-session', payload),
  deleteSession:  (payload)    => ipcRenderer.invoke('delete-session', payload),
  resumeSession:  (id, cwd)    => ipcRenderer.invoke('resume-session', id, cwd),
  copyText:       (text)       => ipcRenderer.invoke('copy-text', text),
})
