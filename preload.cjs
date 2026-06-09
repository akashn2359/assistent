const { contextBridge, ipcRenderer } = require("electron");

contextBridge.exposeInMainWorld("electronAPI", {
  runAction: (action, args) => ipcRenderer.invoke("run-action", { action, args }),
  launchApp: (targetApp, targetPath) => ipcRenderer.invoke("launch-app", { targetApp, targetPath }),
  shutdownControl: (action) => ipcRenderer.invoke("shutdown-control", { action }),
  readTasksFile: () => ipcRenderer.invoke("read-tasks-file"),
  writeTasksFile: (content) => ipcRenderer.invoke("write-tasks-file", content),
  openTasksInNotepad: () => ipcRenderer.invoke("open-tasks-in-notepad"),
  getApiKey: () => ipcRenderer.invoke("get-api-key"),
  startSpeech: () => ipcRenderer.invoke("start-speech"),
  stopSpeech: () => ipcRenderer.invoke("stop-speech"),
  getSpeechStatus: () => ipcRenderer.invoke("get-speech-status"),
  onSpeechStatus: (callback) => {
    const sub = (event, data) => callback(data);
    ipcRenderer.on("speech-status", sub);
    return () => ipcRenderer.removeListener("speech-status", sub);
  },
  onSpeechRecognized: (callback) => {
    const sub = (event, text) => callback(text);
    ipcRenderer.on("speech-recognized", sub);
    return () => ipcRenderer.removeListener("speech-recognized", sub);
  },
  onSpeechRejected: (callback) => {
    const sub = () => callback();
    ipcRenderer.on("speech-rejected", sub);
    return () => ipcRenderer.removeListener("speech-rejected", sub);
  },
  onSpeechError: (callback) => {
    const sub = (event, error) => callback(error);
    ipcRenderer.on("speech-error", sub);
    return () => ipcRenderer.removeListener("speech-error", sub);
  },
  windowControl: (action) => ipcRenderer.send("window-control", action),
  onShortcutTriggered: (callback) => {
    const subscription = (event) => callback();
    ipcRenderer.on("shortcut-triggered", subscription);
    return () => ipcRenderer.removeListener("shortcut-triggered", subscription);
  },
  onStatsUpdated: (callback) => {
    const subscription = (event, stats) => callback(stats);
    ipcRenderer.on("stats-updated", subscription);
    return () => ipcRenderer.removeListener("stats-updated", subscription);
  }
});
