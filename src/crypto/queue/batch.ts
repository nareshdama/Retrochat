export function yieldToMainThread(): Promise<void> {
  return new Promise((resolve) => {
    // Prefer rAF to yield before next paint (smooth scrolling).
    if (typeof requestAnimationFrame !== 'undefined') {
      requestAnimationFrame(() => resolve())
      return
    }
    setTimeout(resolve, 0)
  })
}

export async function mapBatched<T, R>(options: {
  items: readonly T[]
  batchSize: number
  map: (item: T, index: number) => Promise<R>
  onBatch?: (results: R[], startIndex: number, endIndex: number) => void
}): Promise<R[]> {
  const { items, batchSize, map, onBatch } = options
  const out: R[] = []
  const size = Math.max(1, batchSize)

  for (let i = 0; i < items.length; i += size) {
    const slice = items.slice(i, i + size)
    // Run the slice sequentially to avoid spiking CPU on mobile.
    // (AES-GCM/WebCrypto is async but can still increase contention.)
    const results: R[] = []
    for (let j = 0; j < slice.length; j += 1) {
      results.push(await map(slice[j] as T, i + j))
    }
    out.push(...results)
    if (onBatch) onBatch(results, i, Math.min(i + size - 1, items.length - 1))
    // Yield between batches to keep the main thread responsive.
    if (i + size < items.length) {
      await yieldToMainThread()
    }
  }

  return out
}

