import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join, basename, dirname } from 'path'
import { readdirSync, existsSync, mkdirSync, copyFileSync, renameSync, readFileSync, writeFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { autoUpdater } from 'electron-updater'
import { extractAllFields } from './extract'
import type {
  PdfEntry,
  AppSettings,
  ScanResult,
  ExecuteResult,
  ExecuteProgress,
  ScanProgress,
  UpdateStatus
} from '../shared/types'

// eslint-disable-next-line @typescript-eslint/no-require-imports
const pdfParse: (buf: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js')

const MIN_TEXT_CHARS = 50
const SETTINGS_FILE = () => join(app.getPath('userData'), 'settings.json')

// ── Walk PDF files ────────────────────────────────────────────────────────────
function walkPdfs(rootDir: string): Array<{ path: string; subfolder: string; name: string }> {
  const results: Array<{ path: string; subfolder: string; name: string }> = []
  function walk(dir: string) {
    let entries: ReturnType<typeof readdirSync>
    try {
      entries = readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      const full = join(dir, e.name)
      if (e.isDirectory()) {
        walk(full)
      } else if (e.name.toLowerCase().endsWith('.pdf')) {
        const subfolder = dir === rootDir ? '' : basename(dir)
        results.push({ path: full, subfolder, name: e.name })
      }
    }
  }
  walk(rootDir)
  return results
}

// ── Extract text from PDF ─────────────────────────────────────────────────────
async function extractText(filePath: string): Promise<string> {
  try {
    const buf = readFileSync(filePath)
    const data = await pdfParse(buf)
    return data.text ?? ''
  } catch {
    return ''
  }
}

// Yields to the event loop so the main process can flush pending IPC/window
// messages between files, instead of stalling for the whole scan duration.
function tick(): Promise<void> {
  return new Promise((resolve) => setImmediate(resolve))
}

// ── Scan folder ───────────────────────────────────────────────────────────────
async function scanFolder(
  sourceFolder: string,
  onProgress?: (p: ScanProgress) => void
): Promise<ScanResult> {
  const files = walkPdfs(sourceFolder)
  const entries: PdfEntry[] = []
  const imagePdfs: PdfEntry[] = []
  const total = files.length

  for (let i = 0; i < files.length; i++) {
    const { path: filePath, subfolder, name } = files[i]
    const stem = name.replace(/\.pdf$/i, '')
    const text = await extractText(filePath)
    const isImagePdf = text.length < MIN_TEXT_CHARS

    const fields = isImagePdf
      ? { dateISO: '', docTypeCode: '', docTypeFallback: '', series: '', docNumber: '', supplier: '' }
      : extractAllFields(text, stem, subfolder)

    const entry: PdfEntry = {
      id: filePath,
      originalPath: filePath,
      subfolder,
      originalName: name,
      proposedName: '',
      ...fields,
      isImagePdf,
      extractError: false,
      customName: '',
      skip: false
    }

    if (isImagePdf || fields.supplier === 'ΑΓΝΩΣΤΟΣ') {
      imagePdfs.push(entry)
    } else {
      entries.push(entry)
    }

    onProgress?.({ index: i + 1, total, fileName: name })
    await tick()
  }

  return { entries, imagePdfs }
}

// ── Unique path helper ────────────────────────────────────────────────────────
// Mirrors Windows Explorer's "keep both files" naming: name.pdf, name (2).pdf, name (3).pdf, …
function uniquePath(dir: string, name: string): string {
  const stem = name.replace(/\.pdf$/i, '')
  let candidate = join(dir, name)
  if (!existsSync(candidate)) return candidate
  let i = 2
  while (true) {
    candidate = join(dir, `${stem} (${i}).pdf`)
    if (!existsSync(candidate)) return candidate
    i++
  }
}

// ── Window ────────────────────────────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    titleBarStyle: 'default',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow = win
  win.on('closed', () => {
    if (mainWindow === win) mainWindow = null
  })

  win.on('ready-to-show', () => win.show())
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ── Auto-update ───────────────────────────────────────────────────────────────
function sendUpdateStatus(status: UpdateStatus): void {
  mainWindow?.webContents.send('update:status', status)
}

autoUpdater.autoDownload = true
autoUpdater.autoInstallOnAppQuit = true

autoUpdater.on('checking-for-update', () => sendUpdateStatus({ state: 'checking' }))
autoUpdater.on('update-available', (info) =>
  sendUpdateStatus({ state: 'available', version: info.version })
)
autoUpdater.on('update-not-available', () => sendUpdateStatus({ state: 'not-available' }))
autoUpdater.on('download-progress', (p) =>
  sendUpdateStatus({ state: 'downloading', percent: Math.round(p.percent) })
)
autoUpdater.on('update-downloaded', (info) =>
  sendUpdateStatus({ state: 'downloaded', version: info.version })
)
autoUpdater.on('error', (err) => sendUpdateStatus({ state: 'error', message: err.message }))

// ── App lifecycle ─────────────────────────────────────────────────────────────
app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.pdfrenamer.app')
  app.on('browser-window-created', (_, win) => optimizer.watchWindowShortcuts(win))
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  if (!is.dev) {
    // Give the renderer a moment to mount its update-status listener
    setTimeout(() => autoUpdater.checkForUpdates(), 2000)
  }
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

// ── IPC handlers ──────────────────────────────────────────────────────────────
ipcMain.handle('dialog:openFolder', async () => {
  const result = await dialog.showOpenDialog({ properties: ['openDirectory'] })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('pdf:scan', async (event, sourceFolder: string) => {
  return await scanFolder(sourceFolder, (p) => event.sender.send('pdf:scanProgress', p))
})

ipcMain.handle(
  'pdf:execute',
  async (event, entries: PdfEntry[], settings: AppSettings): Promise<ExecuteResult> => {
    const outDir =
      settings.outputMode === 'copy'
        ? settings.useSameFolder
          ? ''
          : settings.outputFolder
        : ''

    let success = 0
    let skipped = 0
    const errorList: Array<{ name: string; msg: string }> = []

    const toProcess = entries.filter((e) => !e.skip)
    const total = toProcess.length

    for (let i = 0; i < toProcess.length; i++) {
      const entry = toProcess[i]
      const finalName = entry.customName || entry.proposedName
      if (!finalName) {
        skipped++
        const prog: ExecuteProgress = {
          index: i + 1,
          total,
          fileName: entry.originalName,
          status: 'skip'
        }
        event.sender.send('pdf:progress', prog)
        continue
      }

      try {
        const destDir =
          settings.outputMode === 'copy'
            ? settings.useSameFolder
              ? dirname(entry.originalPath)
              : outDir
            : dirname(entry.originalPath)

        if (destDir && !existsSync(destDir)) {
          mkdirSync(destDir, { recursive: true })
        }

        const destPath = uniquePath(destDir || dirname(entry.originalPath), `${finalName}.pdf`)

        if (settings.outputMode === 'copy') {
          copyFileSync(entry.originalPath, destPath)
        } else {
          renameSync(entry.originalPath, destPath)
        }

        success++
        const prog: ExecuteProgress = {
          index: i + 1,
          total,
          fileName: finalName,
          status: 'ok'
        }
        event.sender.send('pdf:progress', prog)
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err)
        errorList.push({ name: entry.originalName, msg })
        const prog: ExecuteProgress = {
          index: i + 1,
          total,
          fileName: entry.originalName,
          status: 'error',
          message: msg
        }
        event.sender.send('pdf:progress', prog)
      }
    }

    return { success, skipped, errors: errorList.length, errorList }
  }
)

ipcMain.on('shell:openPath', (_, p: string) => {
  shell.openPath(p)
})

ipcMain.handle('app:getVersion', () => app.getVersion())

ipcMain.on('update:check', () => {
  if (is.dev) {
    sendUpdateStatus({ state: 'error', message: 'Ο έλεγχος ενημερώσεων δεν είναι διαθέσιμος σε λειτουργία ανάπτυξης.' })
    return
  }
  autoUpdater.checkForUpdates()
})

ipcMain.on('update:install', () => {
  autoUpdater.quitAndInstall()
})

ipcMain.handle('settings:load', (): Partial<AppSettings> => {
  try {
    const raw = readFileSync(SETTINGS_FILE(), 'utf-8')
    return JSON.parse(raw)
  } catch {
    return {}
  }
})

ipcMain.handle('settings:save', (_, settings: AppSettings) => {
  try {
    writeFileSync(SETTINGS_FILE(), JSON.stringify(settings, null, 2), 'utf-8')
  } catch {
    // ignore
  }
})
