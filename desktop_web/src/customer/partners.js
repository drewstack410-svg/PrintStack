const ONLINE_WINDOW_MS = 5 * 60 * 1000

export function parseFirestoreDate(value) {
  if (!value) return null
  if (value instanceof Date) return value
  if (typeof value?.toDate === 'function') {
    try {
      return value.toDate()
    } catch {
      return null
    }
  }
  if (typeof value === 'string' && value) {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? null : parsed
  }
  if (typeof value?.seconds === 'number') {
    return new Date(value.seconds * 1000)
  }
  return null
}

export function mapPartner(id, data = {}) {
  const locationRaw = data.location && typeof data.location === 'object' ? data.location : null
  const updatedAt = locationRaw ? parseFirestoreDate(locationRaw.updatedAt) : null
  const flaggedOnline = locationRaw ? locationRaw.online !== false : false
  const online =
    Boolean(flaggedOnline) &&
    updatedAt instanceof Date &&
    Date.now() - updatedAt.getTime() <= ONLINE_WINDOW_MS

  const sizesRaw = Array.isArray(data.paperSizes) ? data.paperSizes : []
  const paperSizes = sizesRaw
    .filter((item) => item && typeof item === 'object')
    .map((item, index) => {
      const legacy = Number(item.pricePerPiece) || 0
      const priceBw = Number(item.priceBw ?? legacy) || 0
      const priceColor = Number(item.priceColor ?? Math.max(legacy, priceBw)) || 0
      return {
        id: String(item.id || `size-${index + 1}`),
        name: String(item.name || ''),
        width: Number(item.width) || 0,
        height: Number(item.height) || 0,
        unit: String(item.unit || 'mm'),
        priceBw,
        priceColor,
        sizeLabel: `${item.width} × ${item.height} ${item.unit || 'mm'}`,
      }
    })

  const servicesRaw = data.services && typeof data.services === 'object' ? data.services : {}

  return {
    id,
    companyName: String(data.companyName || ''),
    email: String(data.email || ''),
    logoUrl: String(data.logoUrl || ''),
    convenienceFee: Number(data.convenienceFee) || 0,
    services: {
      printing: servicesRaw.printing !== false,
      xerox: servicesRaw.xerox === true,
    },
    location: locationRaw
      ? {
          lat: Number(locationRaw.lat) || 0,
          lng: Number(locationRaw.lng) || 0,
          label: String(locationRaw.label || ''),
          flaggedOnline,
          updatedAt,
          online,
        }
      : null,
    paperSizes,
  }
}

export function sortPartners(partners) {
  return [...partners].sort((a, b) => {
    const aOnline = a.location?.online ? 0 : 1
    const bOnline = b.location?.online ? 0 : 1
    if (aOnline !== bOnline) return aOnline - bOnline
    return a.companyName.toLowerCase().localeCompare(b.companyName.toLowerCase())
  })
}
