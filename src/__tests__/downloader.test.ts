import { USER_AGENT } from '../constants'
import { downloadAll, downloadPdf } from '../downloader'
import { mockFetch } from './helpers'

afterEach(() => jest.restoreAllMocks())

describe('downloadPdf', () => {
  it('returns the body as a Buffer on success', async () => {
    mockFetch({ 'https://example.com/a.pdf': { body: Buffer.from('%PDF-a') } })
    const result = await downloadPdf('https://example.com/a.pdf', 'https://example.com/')
    expect(Buffer.isBuffer(result)).toBe(true)
    expect(result?.toString()).toBe('%PDF-a')
  })

  it('sends the user agent and the page as referer', async () => {
    const spy = mockFetch({ 'https://example.com/a.pdf': { body: 'x' } })
    await downloadPdf('https://example.com/a.pdf', 'https://example.com/page')
    const init = spy.mock.calls[0][1] as RequestInit
    expect(init.headers).toEqual({ 'User-Agent': USER_AGENT, Referer: 'https://example.com/page' })
    expect(init.signal).toBeInstanceOf(AbortSignal)
  })

  it('returns null for a non-OK response', async () => {
    mockFetch({ 'https://example.com/a.pdf': { status: 403 } })
    expect(await downloadPdf('https://example.com/a.pdf', 'https://example.com/')).toBeNull()
  })

  it('returns null when the request throws', async () => {
    mockFetch({ 'https://example.com/a.pdf': new Error('network down') })
    expect(await downloadPdf('https://example.com/a.pdf', 'https://example.com/')).toBeNull()
  })
})

describe('downloadAll', () => {
  const urls = ['https://example.com/1.pdf', 'https://example.com/2.pdf', 'https://example.com/3.pdf']

  it('downloads every URL in order', async () => {
    mockFetch(Object.fromEntries(urls.map((u, i) => [u, { body: `pdf-${i + 1}` }])))
    const result = await downloadAll(urls, 'https://example.com/')
    expect(result.map((b) => b.toString())).toEqual(['pdf-1', 'pdf-2', 'pdf-3'])
  })

  it('drops failed downloads', async () => {
    mockFetch({ [urls[0]]: { body: 'pdf-1' }, [urls[2]]: { body: 'pdf-3' } })
    const result = await downloadAll(urls, 'https://example.com/')
    expect(result.map((b) => b.toString())).toEqual(['pdf-1', 'pdf-3'])
  })

  it('works in batches and reports progress after each one', async () => {
    const spy = mockFetch(Object.fromEntries(urls.map((u) => [u, { body: 'x' }])))
    const onProgress = jest.fn()
    await downloadAll(urls, 'https://example.com/', 2, 1000, onProgress)
    expect(spy).toHaveBeenCalledTimes(3)
    expect(onProgress.mock.calls).toEqual([
      [2, 3],
      [3, 3]
    ])
  })

  it('returns an empty array for no URLs', async () => {
    const onProgress = jest.fn()
    expect(await downloadAll([], 'https://example.com/', 5, 1000, onProgress)).toEqual([])
    expect(onProgress).not.toHaveBeenCalled()
  })
})
