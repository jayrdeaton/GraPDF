# grapdf

Scrape all PDFs linked on a webpage and merge them into one downloadable booklet.

```sh
grapdf https://example.com/coloring-pages/
```

## Installation

```sh
npm install -g grapdf
```

Or run without installing:

```sh
npx grapdf <url>
```

## CLI

```sh
grapdf <url> [output]
```

If no output path is given, the filename is derived from the URL slug (e.g. `coloring-pages.pdf`). If a name is given without an extension, `.pdf` is added automatically. Existing files are never overwritten — grapdf increments the filename (`booklet-1.pdf`, `booklet-2.pdf`, etc.).

### Options

**Trim**

| Flag | Description |
|------|-------------|
| `-t`, `--trim <pts>` | Crop all four sides by N points |
| `-v`, `--trim-vertical <pts>` | Crop top and bottom by N points |
| `-h`, `--trim-horizontal <pts>` | Crop left and right by N points |
| `--trim-top <pts>` | Crop N points from the top of each page |
| `--trim-bottom <pts>` | Crop N points from the bottom of each page |
| `--trim-left <pts>` | Crop N points from the left of each page |
| `--trim-right <pts>` | Crop N points from the right of each page |

More specific flags override less specific ones. `--trim 20 --trim-bottom 40` crops 40pt from the bottom and 20pt from the other three sides.

**Filtering**

| Flag | Description |
|------|-------------|
| `--selector <css>` | Scope PDF link search to a CSS selector (e.g. `.content`) |
| `-i`, `--include <pattern>` | Regex pattern — only include matching PDF URLs |
| `-e`, `--exclude <pattern>` | Regex pattern — exclude matching PDF URLs |

**Ordering**

| Flag | Description |
|------|-------------|
| `-s`, `--sort` | Sort PDFs alphabetically by URL before merging |
| `-r`, `--reverse` | Reverse the order of PDFs before merging |

**Download**

| Flag | Description |
|------|-------------|
| `-c`, `--concurrent <n>` | PDFs to download simultaneously (default: `5`) |
| `-l`, `--limit <n>` | Maximum number of PDFs to include |
| `--timeout <ms>` | Per-PDF download timeout in milliseconds (default: `30000`) |

**Other**

| Flag | Description |
|------|-------------|
| `-d`, `--dry-run` | Print the list of PDF URLs that would be fetched, then exit |

### Examples

```sh
# Basic usage
grapdf https://example.com/coloring-pages/

# Custom output filename
grapdf https://example.com/coloring-pages/ my-booklet.pdf

# Remove a 40pt branding border from the bottom of each page
grapdf https://example.com/coloring-pages/ --trim-bottom 40

# Preview what would be downloaded before committing
grapdf https://example.com/coloring-pages/ --dry-run

# Limit to the first 5 PDFs, sorted alphabetically
grapdf https://example.com/coloring-pages/ --sort --limit 5

# Only grab PDFs whose URLs contain "chapter"
grapdf https://example.com/book/ --include chapter

# Exclude any PDFs whose URLs contain "sample"
grapdf https://example.com/book/ --exclude sample

# Scope link search to a specific section of the page
grapdf https://example.com/downloads/ --selector .downloads-grid

# Combine filters: search within a section, include a pattern, trim the bottom
grapdf https://example.com/coloring-pages/ --selector .content --include pokemon --trim-bottom 40
```

## Programmatic API

```sh
npm install grapdf
```

```ts
import { buildBooklet, findPdfUrls, mergePdfs, downloadAll, extractPdfLinks } from 'grapdf'
```

### `buildBooklet(url, options?): Promise<{ pdfCount, bytes }>`

Full pipeline — scrape, download, and merge in one call.

```ts
const { pdfCount, bytes } = await buildBooklet('https://example.com/coloring-pages/', {
  trimBottom: 40,       // crop 40pt from bottom of each page
  include: 'pokemon',   // only URLs matching this regex
  exclude: 'sample',    // exclude URLs matching this regex
  selector: '.content', // scope link search to this CSS selector
  sort: true,           // sort PDFs alphabetically before merging
  reverse: false,       // reverse order before merging
  limit: 20,            // cap at 20 PDFs
  concurrent: 5,        // parallel downloads
  timeout: 30_000,      // ms per PDF
  onProgress: (msg) => console.log(msg),
})

await fs.writeFile('booklet.pdf', bytes)
```

### `findPdfUrls(url, options?): Promise<string[]>`

Scrape and filter PDF URLs without downloading. Useful for previewing or building custom pipelines.

```ts
const urls = await findPdfUrls('https://example.com/coloring-pages/', {
  include: 'pokemon',
  sort: true,
  limit: 10,
})
```

### `mergePdfs(buffers, options?): Promise<Uint8Array>`

Merge an array of PDF buffers into one.

```ts
import { mergePdfs } from 'grapdf'

const bytes = await mergePdfs([bufferA, bufferB], {
  trimBottom: 40,
  trimTop: 0,
  trimLeft: 0,
  trimRight: 0,
})
```

### `downloadAll(urls, referer, concurrent?, timeout?): Promise<Buffer[]>`

Download a list of PDF URLs in batches. Failed downloads are silently skipped.

```ts
import { downloadAll } from 'grapdf'

const buffers = await downloadAll(urls, 'https://example.com/', 5, 30_000)
```

### `extractPdfLinks(html, baseUrl, options?): string[]`

Extract PDF links from an HTML string. Resolves relative and protocol-relative URLs.

```ts
import { extractPdfLinks } from 'grapdf'

const links = extractPdfLinks(html, 'https://example.com/', { selector: '.content' })
```
