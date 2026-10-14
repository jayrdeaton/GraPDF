import { USER_AGENT } from '../constants'
import { extractPdfLinks, scrapePdfLinks } from '../scraper'
import { mockFetch, page } from './helpers'

afterEach(() => jest.restoreAllMocks())

describe('extractPdfLinks skips', () => {
  it.each(['#section.pdf', 'mailto:someone@example.com?subject=a.pdf', 'javascript:open("a.pdf")'])('%s', (href) => {
    expect(extractPdfLinks(page(href), 'https://example.com/')).toEqual([])
  })

  it('anchors with an empty href', () => {
    expect(extractPdfLinks('<a href="">x</a>', 'https://example.com/')).toEqual([])
  })

  it('hrefs that are not valid URLs', () => {
    expect(extractPdfLinks(page('http://[bad.pdf'), 'https://example.com/')).toEqual([])
  })
})

describe('scrapePdfLinks', () => {
  it('fetches the page and returns its PDF links', async () => {
    mockFetch({ 'https://example.com/': { body: page('/a.pdf', '/b.html', 'c.pdf') } })
    expect(await scrapePdfLinks('https://example.com/')).toEqual(['https://example.com/a.pdf', 'https://example.com/c.pdf'])
  })

  it('sends the user agent', async () => {
    const spy = mockFetch({ 'https://example.com/': { body: page() } })
    await scrapePdfLinks('https://example.com/')
    expect((spy.mock.calls[0][1] as RequestInit).headers).toEqual({ 'User-Agent': USER_AGENT })
  })

  it('passes the selector through', async () => {
    mockFetch({ 'https://example.com/': { body: '<div class="c"><a href="/in.pdf">x</a></div><a href="/out.pdf">y</a>' } })
    expect(await scrapePdfLinks('https://example.com/', { selector: '.c' })).toEqual(['https://example.com/in.pdf'])
  })

  it('throws on a non-OK response', async () => {
    mockFetch({})
    await expect(scrapePdfLinks('https://example.com/')).rejects.toThrow('HTTP 404 fetching https://example.com/')
  })
})
