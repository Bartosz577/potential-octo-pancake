import type { FileReaderPlugin, FileReadResult } from '../models/types'
import { TxtFileReader } from './TxtFileReader'
import { CsvFileReader } from './CsvFileReader'
import { XlsxFileReader } from './XlsxFileReader'
import { JsonFileReader } from './JsonFileReader'
import { XmlFileReader } from './XmlFileReader'

/**
 * FileReaderRegistry — central registry for all file reader plugins.
 * Provides auto-detection of file format and routing to the correct reader.
 *
 * Detection strategy:
 * 1. Filter readers by file extension
 * 2. Among matching readers, call canRead() with the buffer
 * 3. Return the first reader that accepts the file
 * 4. If no match by extension, try all readers via canRead() (content-based fallback)
 */
export class FileReaderRegistry {
  private readers: FileReaderPlugin[] = []

  /** Register a reader plugin */
  register(reader: FileReaderPlugin): void {
    this.readers.push(reader)
  }

  /** Get all registered readers */
  getReaders(): ReadonlyArray<FileReaderPlugin> {
    return this.readers
  }

  /** Get all supported file extensions across all readers */
  getSupportedExtensions(): string[] {
    const exts = new Set<string>()
    for (const reader of this.readers) {
      for (const ext of reader.supportedExtensions) {
        exts.add(ext)
      }
    }
    return Array.from(exts)
  }

  /**
   * Find the appropriate reader for a given file.
   * Returns null if no reader can handle the file.
   */
  findReader(buffer: Buffer, filename: string): FileReaderPlugin | null {
    const ext = filename.split('.').pop()?.toLowerCase() ?? ''

    // 1. Try readers that match the file extension
    for (const reader of this.readers) {
      if (reader.supportedExtensions.includes(ext) && reader.canRead(buffer, filename)) {
        return reader
      }
    }

    // 2. Fallback: try all readers via canRead() regardless of extension
    for (const reader of this.readers) {
      if (reader.canRead(buffer, filename)) {
        return reader
      }
    }

    return null
  }

  /**
   * Read a file by auto-detecting the format.
   * Throws if no reader can handle the file.
   */
  read(buffer: Buffer, filename: string): FileReadResult {
    const reader = this.findReader(buffer, filename)

    if (!reader) {
      const ext = filename.split('.').pop()?.toLowerCase() ?? '?'
      throw new Error(
        `Nieobsługiwany format pliku: .${ext}. Obsługiwane: ${this.getSupportedExtensions().map((e) => `.${e}`).join(', ')}`
      )
    }

    return reader.read(buffer, filename)
  }
}

/**
 * Create a registry with all built-in readers pre-registered.
 * Reader order matters for priority — more specific readers should come first.
 */
export function createDefaultRegistry(): FileReaderRegistry {
  const registry = new FileReaderRegistry()

  // Register in order of specificity:
  // 1. Binary formats first (more specific canRead checks)
  registry.register(new XlsxFileReader())
  // 2. Structured text formats
  registry.register(new JsonFileReader())
  registry.register(new XmlFileReader())
  // 3. CSV (before TXT — CSV is a subset of TXT)
  registry.register(new CsvFileReader())
  // 4. Generic text format last (catches .txt, .dat, .tsv)
  registry.register(new TxtFileReader())

  return registry
}
