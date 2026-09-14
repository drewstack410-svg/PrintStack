const ONLINE_MS = 5 * 60 * 1000

function toIso(value) {
  if (!value) {
    return null
  }

  if (typeof value.toDate === 'function') {
    return value.toDate().toISOString()
  }

  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function isLocationOnline(location) {
  if (!location || location.online === false) {
    return false
  }

  const iso = toIso(location.updatedAt)
  if (!iso) {
    return false
  }

  return Date.now() - new Date(iso).getTime() <= ONLINE_MS
}

function mapLocation(location) {
  if (!location || !Number.isFinite(Number(location.lat)) || !Number.isFinite(Number(location.lng))) {
    return null
  }

  return {
    lat: Number(location.lat),
    lng: Number(location.lng),
    label: location.label || '',
    updatedAt: toIso(location.updatedAt),
    online: isLocationOnline(location),
  }
}

module.exports = {
  toIso,
  isLocationOnline,
  mapLocation,
}
