import fs from 'fs/promises'
import os from 'os'
import path from 'path'

import { createProgram } from '../program'
import { makePdf, mockFetch, page, pageCount } from './helpers'

const SITE = 'https://www.example.com/coloring/'

let dir: string
let cwd: string

beforeEach(async () => {
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'grapdf-'))
  cwd = process.cwd()
  process.chdir(dir)
  jest.spyOn(console, 'log').mockImplementation(() => {})
  jest.spyOn(process.stdout, 'write').mockImplementation(() => true)
  jest.spyOn(process.stderr, 'write').mockImplementation(() => true)
})

afterEach(async () => {
  process.chdir(cwd)
  jest.restoreAllMocks()
  await fs.rm(dir, { recursive: true, force: true })
})

const run = (...args: string[]) => createProgram().parse(['node', 'grapdf', ...args])

const serve = async (pdfs: Record<string, number | null>) => {
  const routes: Parameters<typeof mockFetch>[0] = { [SITE]: { body: page(...Object.keys(pdfs).map((n) => `${n}.pdf`)) } }
  for (const [name, pages] of Object.entries(pdfs)) if (pages !== null) routes[`${SITE}${name}.pdf`] = { body: await makePdf(pages) }
  return mockFetch(routes)
}

const exitSpy = () =>
  jest.spyOn(process, 'exit').mockImplementation((code?: string | number | null) => {
    throw new Error(`exit ${code}`)
  })

describe('grapdf', () => {
  it('saves a booklet named after the site', async () => {
    await serve({ a: 1, b: 2 })
    await run(SITE)
    expect(await pageCount(await fs.readFile(path.join(dir, 'example.pdf')))).toBe(3)
  })

  it('adds .pdf to an output name without an extension', async () => {
    await serve({ a: 1 })
    await run(SITE, 'booklet')
    await expect(fs.access(path.join(dir, 'booklet.pdf'))).resolves.toBeUndefined()
  })

  it('keeps an output name that has an extension', async () => {
    await serve({ a: 1 })
    await run(SITE, 'out.pdf')
    await expect(fs.access(path.join(dir, 'out.pdf'))).resolves.toBeUndefined()
  })

  it('never overwrites: numbers the file instead', async () => {
    await serve({ a: 1 })
    await fs.writeFile(path.join(dir, 'out.pdf'), 'existing')
    await fs.writeFile(path.join(dir, 'out-1.pdf'), 'existing')
    await run(SITE, 'out.pdf')
    expect(await fs.readFile(path.join(dir, 'out.pdf'), 'utf8')).toBe('existing')
    expect(await pageCount(await fs.readFile(path.join(dir, 'out-2.pdf')))).toBe(1)
  })

  it('falls back to booklet.pdf for a hostname with no dots', async () => {
    mockFetch({ 'http://localhost/': { body: page('/a.pdf') }, 'http://localhost/a.pdf': { body: await makePdf(1) } })
    await run('http://localhost/')
    await expect(fs.access(path.join(dir, 'booklet.pdf'))).resolves.toBeUndefined()
  })

  it('passes every option through to the booklet', async () => {
    await serve({ c: 1, a: 1, 'b-draft': 1, b: 1, d: null })
    await run(SITE, 'opts.pdf', '-t', '5', '-v', '6', '-h', '7', '--trim-top', '1', '--trim-bottom', '2', '--trim-left', '3', '--trim-right', '4', '--selector', 'body', '-i', 'coloring/[abd]', '-e', 'draft', '-s', '-r', '-c', '2', '-l', '3', '--timeout', '5000')
    const bytes = await fs.readFile(path.join(dir, 'opts.pdf'))
    // d fails to download, so b and a remain: sorted, reversed, limited to 3 = d, b, a
    expect(await pageCount(bytes)).toBe(2)
  })

  it('still saves when some downloads fail', async () => {
    await serve({ a: 1, gone: null })
    await run(SITE, 'partial.pdf')
    expect(await pageCount(await fs.readFile(path.join(dir, 'partial.pdf')))).toBe(1)
  })

  it('exits with 1 when nothing can be built', async () => {
    const exit = exitSpy()
    await serve({})
    await expect(run(SITE)).rejects.toThrow('exit 1')
    expect(exit).toHaveBeenCalledWith(1)
  })

  describe('--dry-run', () => {
    it('lists the PDFs without downloading or writing anything', async () => {
      const spy = await serve({ a: 1, b: 1 })
      await run(SITE, '--dry-run')
      expect(spy).toHaveBeenCalledTimes(1)
      const printed = (console.log as jest.Mock).mock.calls.map((c) => String(c[0])).join('\n')
      expect(printed).toContain(`${SITE}a.pdf`)
      expect(printed).toContain(`${SITE}b.pdf`)
      expect(await fs.readdir(dir)).toEqual([])
    })

    it('exits with 1 when the page cannot be fetched', async () => {
      const exit = exitSpy()
      mockFetch({})
      await expect(run(SITE, '-d')).rejects.toThrow('exit 1')
      expect(exit).toHaveBeenCalledWith(1)
    })
  })
})
