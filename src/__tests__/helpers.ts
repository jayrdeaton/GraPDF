import { PDFDocument } from 'pdf-lib'

// A real PDF with `pages` blank pages of the given size, for merge and booklet tests.
export const makePdf = async (pages = 1, size: [number, number] = [612, 792]): Promise<Buffer> => {
  const doc = await PDFDocument.create()
  for (let i = 0; i < pages; i++) doc.addPage(size)
  return Buffer.from(await doc.save())
}

export const pageCount = async (bytes: Uint8Array): Promise<number> => (await PDFDocument.load(bytes)).getPageCount()

type Route = { status?: number; body?: string | Buffer } | Error

// Mocks global fetch with a URL -> response table. Unlisted URLs return 404.
export const mockFetch = (routes: Record<string, Route>) =>
  jest.spyOn(global, 'fetch').mockImplementation(async (input: string | URL | Request) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    const route = routes[url]
    if (route instanceof Error) throw route
    if (!route) return new Response('not found', { status: 404 })
    const body = typeof route.body === 'string' || route.body === undefined ? route.body : new Uint8Array(route.body)
    return new Response(body ?? '', { status: route.status ?? 200 })
  })

export const page = (...hrefs: string[]): string => `<html><body>${hrefs.map((h) => `<a href="${h}">link</a>`).join('')}</body></html>`
