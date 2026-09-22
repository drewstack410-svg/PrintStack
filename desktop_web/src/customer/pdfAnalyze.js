import * as pdfjs from 'pdfjs-dist'
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker

function fileExtension(name = '') {
  const parts = String(name).toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) : ''
}

export function isPdfFile(file) {
  return fileExtension(file?.name) === 'pdf' || file?.type === 'application/pdf'
}

export function isImageFile(file) {
  const ext = fileExtension(file?.name)
  return ['png', 'jpg', 'jpeg'].includes(ext) || String(file?.type || '').startsWith('image/')
}

function pixelsLookColor(data, width, height) {
  if (!data?.length || width <= 0 || height <= 0) return false
  let sampled = 0
  let colorful = 0
  const stride = 4
  const step = Math.max(stride, Math.floor((width * height) / 4000) * stride)

  for (let i = 0; i + 3 < data.length; i += step) {
    const r = data[i]
    const g = data[i + 1]
    const b = data[i + 2]
    const a = data[i + 3]
    if (a < 30) continue
    const maxc = Math.max(r, g, b)
    const minc = Math.min(r, g, b)
    if (maxc < 18 || minc > 245) continue
    sampled += 1
    if (maxc - minc >= 18) colorful += 1
  }
  if (sampled === 0) return false
  return colorful / sampled >= 0.008
}

function bytesSuggestColor(bytes) {
  const text = new TextDecoder('latin1').decode(bytes)
  const colorHits = (
    text.match(
      /\/DeviceRGB|\/DeviceCMYK|\/ICCBased|\/Separation|\/ColorSpace\s*\/|\/CS\s*\/DeviceRGB|\brg\s|\bRG\s|\bk\s|\bK\s/gi,
    ) || []
  ).length
  const grayHits = (text.match(/\/DeviceGray|\/G\s|\bg\s/gi) || []).length
  return colorHits > 0 && colorHits >= grayHits
}

function estimatePagesFromBytes(bytes) {
  const text = new TextDecoder('latin1').decode(bytes)
  const matches = text.match(/\/Type\s*\/Page(?!\w)/g)
  return matches?.length > 0 ? matches.length : 1
}

function estimateMediaBoxFromBytes(bytes) {
  const text = new TextDecoder('latin1').decode(bytes)
  const match = text.match(
    /\/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]/,
  )
  if (!match) return { pageWidthPt: 0, pageHeightPt: 0 }
  const x0 = Number(match[1]) || 0
  const y0 = Number(match[2]) || 0
  const x1 = Number(match[3]) || 0
  const y1 = Number(match[4]) || 0
  return { pageWidthPt: Math.abs(x1 - x0), pageHeightPt: Math.abs(y1 - y0) }
}

async function analyzeImageFile(file) {
  const url = URL.createObjectURL(file)
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image()
      el.onload = () => resolve(el)
      el.onerror = () => reject(new Error('Could not read image'))
      el.src = url
    })
    const canvas = document.createElement('canvas')
    const maxW = 200
    const scale = Math.min(1, maxW / Math.max(img.width, 1))
    canvas.width = Math.max(1, Math.round(img.width * scale))
    canvas.height = Math.max(1, Math.round(img.height * scale))
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const isColor = pixelsLookColor(data, canvas.width, canvas.height)
    // Approximate points from pixels at 96dpi → points (72dpi)
    const pageWidthPt = (img.width / 96) * 72
    const pageHeightPt = (img.height / 96) * 72
    return {
      kind: 'image',
      pages: 1,
      bwPages: isColor ? 0 : 1,
      colorPages: isColor ? 1 : 0,
      pageIsColor: [isColor],
      pageWidthPt,
      pageHeightPt,
      detectionSource: 'pixels',
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function analyzePdfFile(file) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  try {
    const loadingTask = pdfjs.getDocument({ data: bytes.slice() })
    const doc = await loadingTask.promise
    try {
      const pages = doc.numPages || 1
      let colorPages = 0
      let bwPages = 0
      let pageWidthPt = 0
      let pageHeightPt = 0
      const pageIsColor = []
      let renderedAny = false

      for (let i = 1; i <= pages; i += 1) {
        const page = await doc.getPage(i)
        const base = page.getViewport({ scale: 1 })
        if (i === 1) {
          pageWidthPt = base.width
          pageHeightPt = base.height
        }
        const scale = Math.min(1, 200 / Math.max(base.width, 1))
        const viewport = page.getViewport({ scale })
        const canvas = document.createElement('canvas')
        canvas.width = Math.max(1, Math.floor(viewport.width))
        canvas.height = Math.max(1, Math.floor(viewport.height))
        const ctx = canvas.getContext('2d', { willReadFrequently: true })
        await page.render({ canvasContext: ctx, viewport }).promise
        renderedAny = true
        const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const isColor = pixelsLookColor(data, canvas.width, canvas.height)
        pageIsColor.push(isColor)
        if (isColor) colorPages += 1
        else bwPages += 1
      }

      if (!renderedAny) {
        const allColor = bytesSuggestColor(bytes)
        return {
          kind: 'pdf',
          pages,
          colorPages: allColor ? pages : 0,
          bwPages: allColor ? 0 : pages,
          pageIsColor: Array.from({ length: pages }, () => allColor),
          pageWidthPt,
          pageHeightPt,
          detectionSource: 'content',
        }
      }

      return {
        kind: 'pdf',
        pages: Math.max(1, colorPages + bwPages),
        colorPages,
        bwPages: bwPages < 1 && colorPages < 1 ? 1 : bwPages,
        pageIsColor: pageIsColor.length ? pageIsColor : [false],
        pageWidthPt,
        pageHeightPt,
        detectionSource: 'pixels',
      }
    } finally {
      await doc.destroy()
    }
  } catch (err) {
    console.warn('[pdfAnalyze]', err)
    const pages = estimatePagesFromBytes(bytes)
    const allColor = bytesSuggestColor(bytes)
    const media = estimateMediaBoxFromBytes(bytes)
    return {
      kind: 'pdf',
      pages,
      colorPages: allColor ? pages : 0,
      bwPages: allColor ? 0 : pages,
      pageIsColor: Array.from({ length: pages }, () => allColor),
      pageWidthPt: media.pageWidthPt,
      pageHeightPt: media.pageHeightPt,
      detectionSource: 'content',
    }
  }
}

export async function analyzePrintFile(file) {
  if (!file) {
    return {
      kind: 'unknown',
      pages: 1,
      bwPages: 1,
      colorPages: 0,
      pageIsColor: [false],
      pageWidthPt: 0,
      pageHeightPt: 0,
      detectionSource: 'fallback',
    }
  }
  if (isImageFile(file)) return analyzeImageFile(file)
  if (isPdfFile(file)) return analyzePdfFile(file)
  return {
    kind: 'office',
    pages: 1,
    bwPages: 1,
    colorPages: 0,
    pageIsColor: [false],
    pageWidthPt: 0,
    pageHeightPt: 0,
    detectionSource: 'fallback',
  }
}

function toMm(size, value) {
  return size.unit === 'in' ? value * 25.4 : value
}

/** Match PDF/image page size to a shop layout (same tolerance as mobile). */
export function matchPaperSize(sizes, pageWidthPt, pageHeightPt) {
  if (!sizes?.length || !(pageWidthPt > 0) || !(pageHeightPt > 0)) return null
  const pageWidthMm = pageWidthPt * 25.4 / 72
  const pageHeightMm = pageHeightPt * 25.4 / 72
  const pdfW = Math.min(pageWidthMm, pageHeightMm)
  const pdfH = Math.max(pageWidthMm, pageHeightMm)

  let best = null
  let bestScore = Number.POSITIVE_INFINITY
  for (const size of sizes) {
    const sizeWMm = toMm(size, size.width)
    const sizeHMm = toMm(size, size.height)
    const w = Math.min(sizeWMm, sizeHMm)
    const h = Math.max(sizeWMm, sizeHMm)
    if (w <= 0 || h <= 0) continue
    const score = Math.abs(pdfW - w) + Math.abs(pdfH - h)
    if (score < bestScore) {
      bestScore = score
      best = size
    }
  }
  if (!best || bestScore > 12) return null
  return best
}

export async function renderPdfPageCanvases(file, { maxWidth = 720, signal } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const doc = await pdfjs.getDocument({ data: bytes }).promise
  try {
    const out = []
    for (let i = 1; i <= doc.numPages; i += 1) {
      if (signal?.aborted) break
      const page = await doc.getPage(i)
      const base = page.getViewport({ scale: 1 })
      const scale = Math.min(1.5, maxWidth / Math.max(base.width, 1))
      const viewport = page.getViewport({ scale })
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.floor(viewport.width))
      canvas.height = Math.max(1, Math.floor(viewport.height))
      const ctx = canvas.getContext('2d')
      await page.render({ canvasContext: ctx, viewport }).promise
      out.push(canvas)
    }
    return out
  } finally {
    await doc.destroy()
  }
}

export async function renderPdfThumbnail(file, { maxWidth = 120, signal } = {}) {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (signal?.aborted) return ''
  const doc = await pdfjs.getDocument({ data: bytes }).promise
  try {
    const page = await doc.getPage(1)
    if (signal?.aborted) return ''
    const base = page.getViewport({ scale: 1 })
    const scale = Math.min(1.5, maxWidth / Math.max(base.width, 1))
    const viewport = page.getViewport({ scale })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.floor(viewport.width))
    canvas.height = Math.max(1, Math.floor(viewport.height))
    const ctx = canvas.getContext('2d')
    await page.render({ canvasContext: ctx, viewport }).promise
    return signal?.aborted ? '' : canvas.toDataURL('image/jpeg', 0.82)
  } finally {
    await doc.destroy()
  }
}
