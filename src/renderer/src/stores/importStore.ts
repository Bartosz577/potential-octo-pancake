import { create } from 'zustand'
import type { ParsedFile } from '../types'

interface ImportState {
  files: ParsedFile[]
  addFile: (file: ParsedFile) => void
  updateFile: (id: string, updated: ParsedFile) => void
  removeFile: (id: string) => void
  clearFiles: () => void
}

export const useImportStore = create<ImportState>((set) => ({
  files: [],
  addFile: (file) => set((state) => ({ files: [...state.files, file] })),
  updateFile: (id, updated) =>
    set((state) => ({
      files: state.files.map((f) => (f.id === id ? updated : f))
    })),
  removeFile: (id) => set((state) => ({ files: state.files.filter((f) => f.id !== id) })),
  clearFiles: () => set({ files: [] })
}))
