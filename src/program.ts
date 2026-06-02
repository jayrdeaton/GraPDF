/* eslint-disable no-console */
import cosmeticLib from 'cosmetic'
import fs from 'fs/promises'
import { Spinner } from 'termpulse'
import path from 'path'
import { command } from 'termkit'

import { buildBooklet, findPdfUrls } from './booklet'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const cosmetic = cosmeticLib as any

const slugFromUrl = (url: string): string => url.split('/').filter(Boolean).pop() ?? 'booklet'

const resolveOutputPath = async (desired: string): Promise<string> => {
  try {
    await fs.access(desired)
  } catch {
    return desired
  }
  const ext = path.extname(desired)
  const base = desired.slice(0, desired.length - ext.length)
  let i = 1
  while (true) {
    const candidate = `${base}-${i}${ext}`
    try {
      await fs.access(candidate)
      i++
    } catch {
      return candidate
    }
  }
}

const num = (val: unknown, fallback: number): number => (typeof val === 'string' ? Math.max(0, Number(val)) || fallback : fallback)

export const createProgram = () =>
  command('pdflet', '<url> [output]')
    .description('Scrape all PDFs from a webpage and merge them into one booklet')
    .option('t', 'trim', '[pts]', 'Crop all four sides by N points')
    .option('v', 'trim-vertical', '[pts]', 'Crop top and bottom by N points')
    .option('h', 'trim-horizontal', '[pts]', 'Crop left and right by N points')
    .option(null, 'trim-top', '[pts]', 'Crop N points from the top of each page')
    .option(null, 'trim-bottom', '[pts]', 'Crop N points from the bottom of each page')
    .option(null, 'trim-left', '[pts]', 'Crop N points from the left of each page')
    .option(null, 'trim-right', '[pts]', 'Crop N points from the right of each page')
    .option(null, 'selector', '[css]', 'CSS selector to scope PDF link search (e.g. .content)')
    .option('i', 'include', '[pattern]', 'Regex pattern to filter PDF URLs')
    .option('e', 'exclude', '[pattern]', 'Regex pattern to exclude PDF URLs')
    .option('s', 'sort', null, 'Sort PDFs alphabetically by URL before merging')
    .option('r', 'reverse', null, 'Reverse the order of PDFs before merging')
    .option('c', 'concurrent', '[n]', 'Number of PDFs to download simultaneously (default: 5)')
    .option('l', 'limit', '[n]', 'Maximum number of PDFs to include')
    .option(null, 'timeout', '[ms]', 'Per-PDF download timeout in milliseconds (default: 30000)')
    .option('d', 'dry-run', null, 'Print the list of PDF URLs that would be fetched, then exit')
    .action(async (options) => {
      const url = options.url as string
      const outFile = options.output as string | undefined
      const isDryRun = Boolean(options['dry-run'])

      const bookletOptions = {
        trim: options.trim ? num(options.trim, 0) : undefined,
        trimVertical: options['trim-vertical'] ? num(options['trim-vertical'], 0) : undefined,
        trimHorizontal: options['trim-horizontal'] ? num(options['trim-horizontal'], 0) : undefined,
        trimTop: options['trim-top'] ? num(options['trim-top'], 0) : undefined,
        trimBottom: options['trim-bottom'] ? num(options['trim-bottom'], 0) : undefined,
        trimLeft: options['trim-left'] ? num(options['trim-left'], 0) : undefined,
        trimRight: options['trim-right'] ? num(options['trim-right'], 0) : undefined,
        selector: typeof options.selector === 'string' ? options.selector : undefined,
        include: typeof options.include === 'string' ? options.include : undefined,
        exclude: typeof options.exclude === 'string' ? options.exclude : undefined,
        sort: Boolean(options.sort),
        reverse: Boolean(options.reverse),
        concurrent: options.concurrent ? Math.max(1, Number(options.concurrent)) : undefined,
        limit: options.limit ? Math.max(1, Number(options.limit)) : undefined,
        timeout: options.timeout ? Math.max(1, Number(options.timeout)) : undefined
      }

      if (isDryRun) {
        const spinner = new Spinner({ text: cosmetic.faint('Scanning for PDFs') })
        spinner.start()
        try {
          const pdfUrls = await findPdfUrls(url, bookletOptions)
          spinner.succeed(cosmetic.bold(`${pdfUrls.length} PDF${pdfUrls.length !== 1 ? 's' : ''} found:`)).stop()
          for (const u of pdfUrls) console.log(`  ${cosmetic.cyan(u)}`)
        } catch (err) {
          spinner.fail(cosmetic.red(String(err))).stop()
          process.exit(1)
        }
        return
      }

      const spinner = new Spinner({ text: cosmetic.faint('Scanning for PDFs') })
      spinner.start()

      try {
        const { pdfCount, bytes } = await buildBooklet(url, {
          ...bookletOptions,
          onProgress: (msg) => {
            spinner.message(cosmetic.faint(msg))
          }
        })

        const slug = slugFromUrl(url)
        const defaultName = outFile ? (path.extname(outFile) ? outFile : `${outFile}.pdf`) : `${slug}.pdf`
        const dest = await resolveOutputPath(defaultName)

        spinner.message(cosmetic.faint(`Saving ${dest}`))
        await fs.writeFile(dest, bytes)
        spinner.succeed(`${pdfCount} PDF${pdfCount !== 1 ? 's' : ''} saved to ${cosmetic.underline.cyan(dest)}`).stop()
      } catch (err) {
        spinner.fail(cosmetic.red(String(err))).stop()
        process.exit(1)
      }
    })
