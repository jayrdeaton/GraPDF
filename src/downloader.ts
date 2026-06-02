import { USER_AGENT } from './constants'

export const downloadPdf = async (url: string, referer: string, timeout = 30_000): Promise<Buffer | null> => {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT, Referer: referer },
      signal: AbortSignal.timeout(timeout)
    })
    if (!res.ok) return null
    return Buffer.from(await res.arrayBuffer())
  } catch {
    return null
  }
}

export const downloadAll = async (
  urls: string[],
  referer: string,
  concurrent = 5,
  timeout = 30_000,
  onProgress?: (completed: number, total: number) => void
): Promise<Buffer[]> => {
  const results: (Buffer | null)[] = []
  let completed = 0
  for (let i = 0; i < urls.length; i += concurrent) {
    const batch = await Promise.all(urls.slice(i, i + concurrent).map((u) => downloadPdf(u, referer, timeout)))
    results.push(...batch)
    completed += batch.length
    onProgress?.(completed, urls.length)
  }
  return results.filter((b): b is Buffer => b !== null)
}
