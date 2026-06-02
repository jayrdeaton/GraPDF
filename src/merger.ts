import { PDFDocument } from 'pdf-lib'

export interface MergeOptions {
  trimTop?: number
  trimBottom?: number
  trimLeft?: number
  trimRight?: number
}

export const mergePdfs = async (buffers: Buffer[], options: MergeOptions = {}): Promise<Uint8Array> => {
  const { trimTop = 0, trimBottom = 0, trimLeft = 0, trimRight = 0 } = options
  const merged = await PDFDocument.create()

  for (const buffer of buffers) {
    try {
      const pdf = await PDFDocument.load(buffer, { ignoreEncryption: true })
      const pages = await merged.copyPages(pdf, pdf.getPageIndices())
      for (const page of pages) {
        if (trimTop > 0 || trimBottom > 0 || trimLeft > 0 || trimRight > 0) {
          const { width, height } = page.getSize()
          page.setCropBox(trimLeft, trimBottom, width - trimLeft - trimRight, height - trimBottom - trimTop)
        }
        merged.addPage(page)
      }
    } catch {
      // skip unreadable PDF
    }
  }

  return merged.save()
}
