import { create } from 'zustand'
import type { PdfEntry, AppSettings, ExecuteResult } from '@shared/types'
import { DEFAULT_SETTINGS, buildEntryName } from './utils/buildName'

type Tab = 'setup' | 'preview' | 'execute'

interface Store {
  tab: Tab
  settings: AppSettings
  entries: PdfEntry[]
  imagePdfs: PdfEntry[]
  isScanning: boolean
  executeResult: ExecuteResult | null
  scanError: string

  setTab: (t: Tab) => void
  setSettings: (s: Partial<AppSettings>) => void
  setEntries: (e: PdfEntry[], img: PdfEntry[]) => void
  updateEntry: (id: string, patch: Partial<PdfEntry>) => void
  updateImagePdf: (id: string, patch: Partial<PdfEntry>) => void
  rebuildNames: () => void
  setIsScanning: (v: boolean) => void
  setScanError: (e: string) => void
  setExecuteResult: (r: ExecuteResult | null) => void
}

export const useStore = create<Store>((set, get) => ({
  tab: 'setup',
  settings: DEFAULT_SETTINGS,
  entries: [],
  imagePdfs: [],
  isScanning: false,
  executeResult: null,
  scanError: '',

  setTab: (tab) => set({ tab }),

  setSettings: (patch) => {
    set((s) => ({ settings: { ...s.settings, ...patch } }))
    // Rebuild proposed names whenever settings change
    const { entries, imagePdfs, settings } = get()
    const newSettings = { ...settings, ...patch }
    set({
      entries: entries.map((e) => ({
        ...e,
        proposedName: e.customName || buildEntryName(e, newSettings)
      })),
      imagePdfs: imagePdfs.map((e) => ({
        ...e,
        proposedName: e.customName || buildEntryName(e, newSettings)
      }))
    })
  },

  setEntries: (entries, imagePdfs) => {
    const { settings } = get()
    set({
      entries: entries.map((e) => ({
        ...e,
        proposedName: buildEntryName(e, settings)
      })),
      imagePdfs: imagePdfs.map((e) => ({
        ...e,
        proposedName: buildEntryName(e, settings)
      })),
      // A fresh scan means any previous run's summary is stale
      executeResult: null
    })
  },

  updateEntry: (id, patch) =>
    set((s) => ({
      entries: s.entries.map((e) => (e.id === id ? { ...e, ...patch } : e))
    })),

  updateImagePdf: (id, patch) =>
    set((s) => ({
      imagePdfs: s.imagePdfs.map((e) => (e.id === id ? { ...e, ...patch } : e))
    })),

  rebuildNames: () => {
    const { entries, imagePdfs, settings } = get()
    set({
      entries: entries.map((e) => ({
        ...e,
        proposedName: e.customName || buildEntryName(e, settings)
      })),
      imagePdfs: imagePdfs.map((e) => ({
        ...e,
        proposedName: e.customName || buildEntryName(e, settings)
      }))
    })
  },

  setIsScanning: (v) => set({ isScanning: v }),
  setScanError: (e) => set({ scanError: e }),
  setExecuteResult: (r) => set({ executeResult: r })
}))
