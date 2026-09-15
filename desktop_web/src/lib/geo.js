import {
  autocompleteLocationViaApi,
  fetchRouteViaApi,
  locateViaApi,
  reverseGeocodeViaApi,
} from '../api'

/** Used only to load the Google Maps JS map widget (tiles), not for geo APIs. */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

/** Prefer fixes better than this (meters). Desktops often land ~20–80m with Wi‑Fi. */
export const GOOD_ACCURACY_M = 100
/** Coarser than this is treated as unusable for overwriting a known shop pin. */
export const MAX_ACCEPTABLE_ACCURACY_M = 500

function toCoords(position, source = 'device') {
  return {
    latitude: position.coords.latitude,
    longitude: position.coords.longitude,
    accuracy: Number(position.coords.accuracy),
    source,
  }
}

/**
 * Watch OS / Chromium location until accuracy is good enough, or return the
 * best sample seen before timeout. Desktop PCs need a few samples for Wi‑Fi.
 */
export function locateWithDevice({
  timeoutMs = 25_000,
  goodAccuracyM = GOOD_ACCURACY_M,
} = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available'))
      return
    }

    let best = null
    let settled = false
    let watchId = null
    let timer = null

    const finish = (result, error) => {
      if (settled) {
        return
      }
      settled = true
      if (timer != null) {
        window.clearTimeout(timer)
      }
      if (watchId != null) {
        navigator.geolocation.clearWatch(watchId)
      }
      if (result) {
        resolve(result)
        return
      }
      reject(error || new Error('Could not get an accurate location'))
    }

    watchId = navigator.geolocation.watchPosition(
      (position) => {
        const next = toCoords(position, 'device')
        if (!best || !Number.isFinite(best.accuracy) || next.accuracy < best.accuracy) {
          best = next
        }
        if (Number.isFinite(next.accuracy) && next.accuracy <= goodAccuracyM) {
          finish(next)
        }
      },
      (error) => {
        if (best) {
          finish(best)
          return
        }
        finish(null, error)
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: timeoutMs,
      },
    )

    timer = window.setTimeout(() => {
      if (best) {
        finish(best)
        return
      }
      finish(null, new Error('Location timed out — enable Windows Location services'))
    }, timeoutMs)
  })
}

/** Network / IP locate through PrintStack API (city-level; last resort only). */
export async function locateWithApi(idToken) {
  const payload = await locateViaApi(idToken)
  const location = payload.location || {}
  const latitude = Number(location.lat)
  const longitude = Number(location.lng)

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error('Could not determine location from API')
  }

  return {
    latitude,
    longitude,
    label: location.label || '',
    // IP / cell tower locate is typically kilometers off.
    accuracy: 50_000,
    source: 'network',
  }
}

/** Reverse geocode through PrintStack API. */
export async function reverseGeocode(lat, lng, idToken) {
  if (!idToken || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return ''
  }

  try {
    const payload = await reverseGeocodeViaApi(idToken, lat, lng)
    return String(payload.label || '')
  } catch {
    return ''
  }
}

/** Place autocomplete through PrintStack API (Geoapify). */
export async function searchLocations(query, idToken) {
  const text = String(query || '').trim()
  if (!idToken || text.length < 2) {
    return []
  }

  const payload = await autocompleteLocationViaApi(idToken, text)
  return Array.isArray(payload.results) ? payload.results : []
}

/** Driving route through PrintStack API. */
export async function fetchRoute(idToken, origin, destination) {
  const payload = await fetchRouteViaApi(idToken, {
    fromLat: origin.lat ?? origin.latitude,
    fromLng: origin.lng ?? origin.longitude,
    toLat: destination.lat ?? destination.latitude,
    toLng: destination.lng ?? destination.longitude,
  })

  return payload.route || {
    points: [],
    distanceText: '',
    durationText: '',
  }
}

export function isAccurateEnough(coords, maxAccuracyM = MAX_ACCEPTABLE_ACCURACY_M) {
  if (!coords) {
    return false
  }
  const accuracy = Number(coords.accuracy)
  if (!Number.isFinite(accuracy)) {
    // Device sometimes omits accuracy — treat as usable only for device source.
    return coords.source === 'device' || coords.source === 'manual'
  }
  return accuracy <= maxAccuracyM
}

/**
 * Prefer refined device GPS/Wi‑Fi. Network/IP fallback only when explicitly allowed
 * (first-time bootstrap with no saved shop pin).
 */
export async function readTrackedCoords(idToken, { allowNetworkFallback = false } = {}) {
  try {
    return await locateWithDevice()
  } catch (error) {
    if (!allowNetworkFallback) {
      throw error
    }
    return locateWithApi(idToken)
  }
}
