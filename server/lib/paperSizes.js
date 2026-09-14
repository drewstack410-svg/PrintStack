export const DEFAULT_PAPER_SIZES = [
  { id: 'a4', name: 'A4', width: 210, height: 297, unit: 'mm', pricePerPiece: 0 },
  { id: 'a3', name: 'A3', width: 297, height: 420, unit: 'mm', pricePerPiece: 0 },
  { id: 'a5', name: 'A5', width: 148, height: 210, unit: 'mm', pricePerPiece: 0 },
  { id: 'short', name: 'Short', width: 8.5, height: 11, unit: 'in', pricePerPiece: 0 },
  { id: 'long', name: 'Long', width: 8.5, height: 13, unit: 'in', pricePerPiece: 0 },
]

export function mapPaperSize(item = {}, fallbackId = '') {
  const unit = item.unit === 'in' ? 'in' : 'mm'
  const price = Number(item.pricePerPiece)
  const width = Number(item.width)
  const height = Number(item.height)

  return {
    id: String(item.id || fallbackId),
    name: String(item.name || '').trim(),
    width: Number.isFinite(width) ? width : 0,
    height: Number.isFinite(height) ? height : 0,
    unit,
    pricePerPiece: Number.isFinite(price) ? price : 0,
  }
}

export function normalizePaperSizes(list) {
  if (!Array.isArray(list) || list.length === 0) {
    return DEFAULT_PAPER_SIZES.map((size) => ({ ...size }))
  }

  return list
    .map((item, index) => mapPaperSize(item, `size-${index + 1}`))
    .filter((item) => item.id && item.name)
}
