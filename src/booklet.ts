import { downloadAll } from './downloader'
import { type MergeOptions, mergePdfs } from './merger'
import { type ScrapeOptions, scrapePdfLinks } from './scraper'

export interface BookletOptions {
  // trim shorthands (resolved into MergeOptions before merging)
  trim?: number
  trimVertical?: number
  trimHorizontal?: number
  trimTop?: number
  trimBottom?: number
  trimLeft?: number
  trimRight?: number
  // scrape
  selector?: string
  include?: string
  exclude?: string
  // order
  sort?: boolean
  reverse?: boolean
  limit?: number
  // download
  concurrent?: number
  timeout?: number
  onProgress?: (stage: string, completed?: number, total?: number) => void
}

export interface BookletResult {
  pdfCount: number
  attempted: number
  bytes: Uint8Array
}

const resolveTrim = (options: BookletOptions): MergeOptions => {
  const base = options.trim ?? 0
  const vertical = options.trimVertical ?? base
  const horizontal = options.trimHorizontal ?? base
  return {
    trimTop: options.trimTop ?? vertical,
    trimBottom: options.trimBottom ?? vertical,
    trimLeft: options.trimLeft ?? horizontal,
    trimRight: options.trimRight ?? horizontal
  }
}

export const findPdfUrls = async (url: string, options: BookletOptions = {}): Promise<string[]> => {
  const { sort = false, reverse = false, limit, selector, include, exclude } = options

  const scrapeOptions: ScrapeOptions = { selector }
  let pdfUrls = await scrapePdfLinks(url, scrapeOptions)

  if (include) {
    const includePattern = new RegExp(include)
    pdfUrls = pdfUrls.filter((u) => includePattern.test(u))
  }

  if (exclude) {
    const excludePattern = new RegExp(exclude)
    pdfUrls = pdfUrls.filter((u) => !excludePattern.test(u))
  }

  if (sort) pdfUrls = [...pdfUrls].sort()
  if (reverse) pdfUrls = [...pdfUrls].reverse()
  if (limit) pdfUrls = pdfUrls.slice(0, limit)

  return pdfUrls
}

export const buildBooklet = async (url: string, options: BookletOptions = {}): Promise<BookletResult> => {
  const { concurrent = 5, timeout = 30_000, onProgress } = options
  const mergeOptions = resolveTrim(options)

  onProgress?.('scanning')
  const pdfUrls = await findPdfUrls(url, options)

  if (pdfUrls.length === 0) throw new Error('No PDF links found on that page')

  const total = pdfUrls.length
  onProgress?.('downloading', 0, total)
  const buffers = await downloadAll(pdfUrls, url, concurrent, timeout, (completed) => {
    onProgress?.('downloading', completed, total)
  })

  if (buffers.length === 0) throw new Error('Failed to download any PDFs')

  onProgress?.('merging', 0, buffers.length)
  const bytes = await mergePdfs(buffers, mergeOptions)

  return { pdfCount: buffers.length, attempted: total, bytes }
}
