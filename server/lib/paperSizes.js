const DEFAULT_PAPER_SIZES = [
  {
    id: 'letter',
    name: 'Letter',
    width: 8.5,
    height: 11,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'tabloid',
    name: 'Tabloid',
    width: 11,
    height: 17,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'legal',
    name: 'Legal',
    width: 8.5,
    height: 14,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'statement',
    name: 'Statement',
    width: 5.5,
    height: 8.5,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'executive',
    name: 'Executive',
    width: 7.25,
    height: 10.5,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'a3',
    name: 'A3',
    width: 11.69,
    height: 16.54,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'a4',
    name: 'A4',
    width: 8.27,
    height: 11.69,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'a5',
    name: 'A5',
    width: 5.83,
    height: 8.27,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'b4-jis',
    name: 'B4 (JIS)',
    width: 10.12,
    height: 14.33,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'b5-jis',
    name: 'B5 (JIS)',
    width: 7.17,
    height: 10.12,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'envelope-9',
    name: 'Envelope #9',
    width: 3.875,
    height: 8.875,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'envelope-10',
    name: 'Envelope #10',
    width: 4.125,
    height: 9.5,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
  {
    id: 'c-size',
    name: 'C size sheet',
    width: 17,
    height: 22,
    unit: 'in',
    pricePerPiece: 0,
    priceBw: 0,
    priceColor: 0,
  },
]

/** Previous built-in set (mm + Short/Long). */
const LEGACY_DEFAULT_IDS = new Set(['a4', 'a3', 'a5', 'short', 'long'])

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

function isLegacyDefaultPaperSizes(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return true
  }

  if (list.length !== LEGACY_DEFAULT_IDS.size) {
    return false
  }

  return list.every((item) => LEGACY_DEFAULT_IDS.has(String(item.id || '')))
}

function normalizePaperSizes(list) {
  if (!Array.isArray(list) || list.length === 0 || isLegacyDefaultPaperSizes(list)) {
    return DEFAULT_PAPER_SIZES.map((size) => ({ ...size }))
  }

  return list
    .map((item, index) => mapPaperSize(item, `size-${index + 1}`))
    .filter((item) => item.id && item.name)
}

module.exports = {
  DEFAULT_PAPER_SIZES,
  LEGACY_DEFAULT_IDS,
  isLegacyDefaultPaperSizes,
  mapPaperSize,
  normalizePaperSizes,
}
