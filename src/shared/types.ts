export interface PdfEntry {
  id: string
  originalPath: string
  subfolder: string
  originalName: string
  proposedName: string
  // extracted
  dateISO: string
  docTypeCode: string
  docTypeFallback: string
  series: string
  docNumber: string
  supplier: string
  // flags
  isImagePdf: boolean
  extractError: boolean
  // user overrides
  customName: string
  skip: boolean
}

export type TokenId = 'DATE' | 'DOCTYPE' | 'SERIES' | 'DOCNUMBER' | 'SUPPLIER' | 'AMOUNT' | 'CUSTOM'

export interface FormatToken {
  id: string
  type: TokenId
  label: string
  customText?: string
}

export type DateFormat =
  | 'DD-MM-YYYY'
  | 'YYYY-MM-DD'
  | 'MM-DD-YYYY'
  | 'DDMMYYYY'
  | 'YYYYMMDD'

export interface AppSettings {
  sourceFolder: string
  outputFolder: string
  useSameFolder: boolean
  outputMode: 'copy' | 'rename'
  tokens: FormatToken[]
  separator: string
  dateFormat: DateFormat
}

export interface ScanResult {
  entries: PdfEntry[]
  imagePdfs: PdfEntry[]
}

export interface ExecuteProgress {
  index: number
  total: number
  fileName: string
  status: 'ok' | 'skip' | 'error'
  message?: string
}

export interface ExecuteResult {
  success: number
  skipped: number
  errors: number
  errorList: Array<{ name: string; msg: string }>
}

export interface ElectronAPI {
  openFolder: () => Promise<string | null>
  scanFolder: (sourceFolder: string) => Promise<ScanResult>
  execute: (
    entries: PdfEntry[],
    settings: AppSettings
  ) => Promise<ExecuteResult>
  onExecuteProgress: (callback: (p: ExecuteProgress) => void) => () => void
  openInExplorer: (path: string) => void
  openPdf: (path: string) => void
  loadSettings: () => Promise<Partial<AppSettings>>
  saveSettings: (settings: AppSettings) => Promise<void>
  getAppVersion: () => Promise<string>
  checkForUpdates: () => void
  installUpdate: () => void
  onUpdateStatus: (callback: (status: UpdateStatus) => void) => () => void
}

export type UpdateState =
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

export interface UpdateStatus {
  state: UpdateState
  version?: string
  percent?: number
  message?: string
}
