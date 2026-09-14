const DEFAULT_PAPER_SIZES = [
  {
    id: 'a4',
    name: 'A4',
    width: 210,
    height: 297,
    unit: 'mm',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'a3',
    name: 'A3',
    width: 297,
    height: 420,
    unit: 'mm',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'a5',
    name: 'A5',
    width: 148,
    height: 210,
    unit: 'mm',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'short',
    name: 'Short',
    width: 8.5,
    height: 11,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'long',
    name: 'Long',
    width: 8.5,
    height: 13,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
]

function toPrice(value, fallback = 0) {
  const price = Number(value)
  return Number.isFinite(price) ? Math.max(0, price) : fallback
}

function mapPaperSize(item = {}, fallbackId = '') {
  const unit = item.unit === 'in' ? 'in' : 'mm'
  const width = Number(item.width)
  const height = Number(item.height)
  const legacy = toPrice(item.pricePerPiece, 0)
  const priceBw = toPrice(item.priceBw, legacy)
  const priceColor = toPrice(item.priceColor, Math.max(legacy, priceBw))

  return {
    id: String(item.id || fallbackId),
    name: String(item.name || '').trim(),
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    unit,
    // Legacy field kept for older clients; treated as B&W price.
    pricePerPiece: priceBw,
    priceBw,
    priceColor,
  }
}

function normalizePaperSizes(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_PAPER_SIZES.map((size) => ({ ...size }))
  }

  return list
    .map((item, index) => mapPaperSize(item, `size-${index + 1}`))
    .filter((item) => item.id && item.name)
}

module.exports = {
  DEFAULT_PAPER_SIZES,
  mapPaperSize,
  normalizePaperSizes,
}
