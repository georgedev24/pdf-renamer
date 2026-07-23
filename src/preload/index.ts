import { contextBridge, ipcRenderer } from 'electron'
import type {
  ElectronAPI,
  PdfEntry,
  AppSettings,
  ExecuteProgress,
  ScanProgress,
  UpdateStatus
} from '../shared/types'

const api: ElectronAPI = {
  openFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  scanFolder: (sourceFolder) => ipcRenderer.invoke('pdf:scan', sourceFolder),

  onScanProgress: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, p: ScanProgress) => callback(p)
    ipcRenderer.on('pdf:scanProgress', handler)
    return () => ipcRenderer.removeListener('pdf:scanProgress', handler)
  },

  execute: (entries, settings) => ipcRenderer.invoke('pdf:execute', entries, settings),

  onExecuteProgress: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, p: ExecuteProgress) => callback(p)
    ipcRenderer.on('pdf:progress', handler)
    return () => ipcRenderer.removeListener('pdf:progress', handler)
  },

  openInExplorer: (path) => ipcRenderer.send('shell:openPath', path),

  openPdf: (path) => ipcRenderer.send('shell:openPath', path),

  loadSettings: () => ipcRenderer.invoke('settings:load'),

  saveSettings: (settings) => ipcRenderer.invoke('settings:save', settings),

  getAppVersion: () => ipcRenderer.invoke('app:getVersion'),

  checkForUpdates: () => ipcRenderer.send('update:check'),

  installUpdate: () => ipcRenderer.send('update:install'),

  onUpdateStatus: (callback) => {
    const handler = (_: Electron.IpcRendererEvent, s: UpdateStatus) => callback(s)
    ipcRenderer.on('update:status', handler)
    return () => ipcRenderer.removeListener('update:status', handler)
  }
}

if (process.contextIsolated) {
  contextBridge.exposeInMainWorld('api', api)
} else {
  // @ts-ignore
  window.api = api
}

export type { ElectronAPI, PdfEntry, AppSettings, ExecuteProgress, ScanProgress, UpdateStatus }
