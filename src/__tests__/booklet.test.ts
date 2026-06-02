jest.mock('termpulse', () => ({
  __esModule: true,
  Spinner: jest.fn().mockImplementation(() => ({ start: jest.fn(), stop: jest.fn(), message: jest.fn() }))
}))

jest.mock('cosmetic', () => ({
  __esModule: true,
  default: new Proxy({}, { get: () => new Proxy((s: string) => s, { get: () => (s: string) => s }) })
}))

import { extractPdfLinks } from '../scraper'
import { mergePdfs } from '../merger'
import { createProgram } from '../program'

describe('extractPdfLinks', () => {
  it('finds direct pdf links', () => {
    const html = '<a href="file.pdf">Download</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toContain('https://example.com/file.pdf')
  })

  it('resolves root-relative links', () => {
    const html = '<a href="/docs/file.pdf">Download</a>'
    const links = extractPdfLinks(html, 'https://example.com/page/')
    expect(links).toContain('https://example.com/docs/file.pdf')
  })

  it('keeps absolute links from other domains', () => {
    const html = '<a href="https://cdn.example.com/file.pdf">Download</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toContain('https://cdn.example.com/file.pdf')
  })

  it('resolves protocol-relative links', () => {
    const html = '<a href="//cdn.example.com/file.pdf">Download</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toContain('https://cdn.example.com/file.pdf')
  })

  it('deduplicates identical links', () => {
    const html = '<a href="file.pdf">1</a><a href="file.pdf">2</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toHaveLength(1)
  })

  it('ignores non-pdf links', () => {
    const html = '<a href="/image.jpg">Image</a><a href="/page">Page</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toHaveLength(0)
  })

  it('matches case-insensitively', () => {
    const html = '<a href="/file.PDF">Download</a>'
    const links = extractPdfLinks(html, 'https://example.com/')
    expect(links).toHaveLength(1)
  })

  it('scopes search to a CSS selector', () => {
    const html = '<div class="content"><a href="/good.pdf">Good</a></div><a href="/bad.pdf">Bad</a>'
    const links = extractPdfLinks(html, 'https://example.com/', { selector: '.content' })
    expect(links).toContain('https://example.com/good.pdf')
    expect(links).not.toContain('https://example.com/bad.pdf')
  })
})

describe('mergePdfs', () => {
  it('returns a Uint8Array for an empty input', async () => {
    const result = await mergePdfs([])
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('skips invalid buffers without throwing', async () => {
    const invalid = Buffer.from('not a pdf')
    const result = await mergePdfs([invalid])
    expect(result).toBeInstanceOf(Uint8Array)
  })

  it('accepts trim options without throwing', async () => {
    const result = await mergePdfs([], { trimTop: 10, trimBottom: 40, trimLeft: 5, trimRight: 5 })
    expect(result).toBeInstanceOf(Uint8Array)
  })
})

describe('createProgram', () => {
  it('creates a command named pdflet', () => {
    const cmd = createProgram()
    expect(cmd.name).toBe('pdflet')
  })

  it('has a description', () => {
    const cmd = createProgram()
    expect(cmd.info).toBeTruthy()
  })

  const flagsWithShort = [
    { long: 'trim', short: 't' },
    { long: 'trim-vertical', short: 'v' },
    { long: 'trim-horizontal', short: 'h' },
    { long: 'include', short: 'i' },
    { long: 'exclude', short: 'e' },
    { long: 'sort', short: 's' },
    { long: 'reverse', short: 'r' },
    { long: 'concurrent', short: 'c' },
    { long: 'limit', short: 'l' },
    { long: 'dry-run', short: 'd' }
  ]

  const flagsWithoutShort = ['trim-top', 'trim-bottom', 'trim-left', 'trim-right', 'selector', 'timeout']

  it.each(flagsWithShort)('has a -$short/--$long option', ({ long, short }) => {
    const cmd = createProgram()
    const opt = cmd.optionsArray.find((o) => o.long === long)
    expect(opt).toBeDefined()
    expect(opt?.short).toBe(short)
  })

  it.each(flagsWithoutShort.map((long) => ({ long })))('has a --$long option', ({ long }) => {
    const cmd = createProgram()
    const opt = cmd.optionsArray.find((o) => o.long === long)
    expect(opt).toBeDefined()
  })
})
