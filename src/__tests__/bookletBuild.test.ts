import { PDFDocument } from 'pdf-lib'

import { buildBooklet, findPdfUrls } from '../booklet'
import { makePdf, mockFetch, page, pageCount } from './helpers'

const SITE = 'https://example.com/'
const links = ['/c.pdf', '/a.pdf', '/b-draft.pdf', '/b.pdf']

afterEach(() => jest.restoreAllMocks())

describe('findPdfUrls', () => {
  beforeEach(() => mockFetch({ [SITE]: { body: page(...links) } }))

  it('returns links in page order by default', async () => {
    expect(await findPdfUrls(SITE)).toEqual(['c', 'a', 'b-draft', 'b'].map((n) => `${SITE}${n}.pdf`))
  })

  it('filters with include and exclude patterns', async () => {
    expect(await findPdfUrls(SITE, { include: 'com/[ab]', exclude: 'draft' })).toEqual([`${SITE}a.pdf`, `${SITE}b.pdf`])
  })

  it('sorts, reverses, and limits', async () => {
    expect(await findPdfUrls(SITE, { sort: true })).toEqual(['a', 'b-draft', 'b', 'c'].map((n) => `${SITE}${n}.pdf`))
    expect(await findPdfUrls(SITE, { reverse: true })).toEqual(['b', 'b-draft', 'a', 'c'].map((n) => `${SITE}${n}.pdf`))
    expect(await findPdfUrls(SITE, { sort: true, reverse: true, limit: 2 })).toEqual([`${SITE}c.pdf`, `${SITE}b.pdf`])
  })
})

describe('buildBooklet', () => {
  const site = async (pdfs: Record<string, number | null>) => {
    const routes: Parameters<typeof mockFetch>[0] = { [SITE]: { body: page(...Object.keys(pdfs).map((n) => `/${n}.pdf`)) } }
    for (const [name, pages] of Object.entries(pdfs)) if (pages !== null) routes[`${SITE}${name}.pdf`] = { body: await makePdf(pages, [600, 800]) }
    return mockFetch(routes)
  }

  it('merges every PDF on the page into one booklet', async () => {
    await site({ one: 1, two: 2 })
    const result = await buildBooklet(SITE)
    expect(result.pdfCount).toBe(2)
    expect(result.attempted).toBe(2)
    expect(await pageCount(result.bytes)).toBe(3)
  })

  it('reports each stage through onProgress', async () => {
    await site({ one: 1, two: 1 })
    const onProgress = jest.fn()
    await buildBooklet(SITE, { onProgress, concurrent: 1 })
    expect(onProgress.mock.calls).toEqual([['scanning'], ['downloading', 0, 2], ['downloading', 1, 2], ['downloading', 2, 2], ['merging', 0, 2]])
  })

  it('reports failed downloads and still builds from the rest', async () => {
    await site({ one: 1, missing: null, three: 1 })
    const onFailed = jest.fn()
    const result = await buildBooklet(SITE, { onFailed })
    expect(onFailed).toHaveBeenCalledWith(1)
    expect(result).toMatchObject({ pdfCount: 2, attempted: 3 })
  })

  it('does not call onFailed when everything downloads', async () => {
    await site({ one: 1 })
    const onFailed = jest.fn()
    await buildBooklet(SITE, { onFailed })
    expect(onFailed).not.toHaveBeenCalled()
  })

  it('throws when the page has no PDF links', async () => {
    mockFetch({ [SITE]: { body: page('/index.html') } })
    await expect(buildBooklet(SITE)).rejects.toThrow('No PDF links found on that page')
  })

  it('throws when every download fails', async () => {
    await site({ gone: null })
    await expect(buildBooklet(SITE)).rejects.toThrow('Failed to download any PDFs')
  })

  describe('trim shorthands', () => {
    const cropOf = async (options: Parameters<typeof buildBooklet>[1]) => {
      await site({ one: 1 })
      return (await PDFDocument.load((await buildBooklet(SITE, options)).bytes)).getPage(0).getCropBox()
    }

    it('trim applies to all four sides', async () => {
      expect(await cropOf({ trim: 10 })).toEqual({ x: 10, y: 10, width: 580, height: 780 })
    })

    it('vertical and horizontal override trim', async () => {
      expect(await cropOf({ trim: 10, trimVertical: 20, trimHorizontal: 5 })).toEqual({ x: 5, y: 20, width: 590, height: 760 })
    })

    it('single sides override everything else', async () => {
      expect(await cropOf({ trim: 10, trimVertical: 20, trimTop: 1, trimLeft: 2 })).toEqual({ x: 2, y: 20, width: 588, height: 779 })
    })
  })
})
