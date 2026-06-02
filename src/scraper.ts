import * as cheerio from 'cheerio'

import { USER_AGENT } from './constants'

export interface ScrapeOptions {
  selector?: string
}

export const extractPdfLinks = (html: string, baseUrl: string, options: ScrapeOptions = {}): string[] => {
  const { selector } = options
  const $ = cheerio.load(html)
  const pdfs = new Set<string>()

  const anchors = selector ? $(`${selector} a[href]`) : $('a[href]')

  anchors.each((_, el) => {
    const raw = $(el).attr('href')!
    if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('javascript:')) return

    let href: string
    try {
      href = new URL(raw, baseUrl).href
    } catch {
      return
    }

    if (href.toLowerCase().includes('.pdf')) pdfs.add(href)
  })

  return [...pdfs]
}

export const scrapePdfLinks = async (url: string, options: ScrapeOptions = {}): Promise<string[]> => {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000)
  })
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`)
  const html = await res.text()
  return extractPdfLinks(html, url, options)
}
