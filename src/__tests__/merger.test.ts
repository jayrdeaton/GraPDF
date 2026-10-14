import { PDFDocument } from 'pdf-lib'

import { mergePdfs } from '../merger'
import { makePdf, pageCount } from './helpers'

describe('mergePdfs with real PDFs', () => {
  it('concatenates every page in order', async () => {
    const merged = await mergePdfs([await makePdf(2), await makePdf(3)])
    expect(await pageCount(merged)).toBe(5)
  })

  it('skips an unreadable buffer and keeps the rest', async () => {
    const merged = await mergePdfs([await makePdf(1), Buffer.from('not a pdf'), await makePdf(2)])
    expect(await pageCount(merged)).toBe(3)
  })

  it('leaves the crop box alone when there is no trim', async () => {
    const merged = await PDFDocument.load(await mergePdfs([await makePdf(1, [600, 800])]))
    expect(merged.getPage(0).getCropBox()).toEqual({ x: 0, y: 0, width: 600, height: 800 })
  })

  it('crops each side by its own trim', async () => {
    const bytes = await mergePdfs([await makePdf(2, [600, 800])], { trimTop: 10, trimBottom: 20, trimLeft: 30, trimRight: 40 })
    const merged = await PDFDocument.load(bytes)
    for (const p of merged.getPages()) {
      expect(p.getCropBox()).toEqual({ x: 30, y: 20, width: 530, height: 770 })
    }
  })
})
