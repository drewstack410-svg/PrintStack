import { fetchRouteViaApi, locateViaApi, reverseGeocodeViaApi } from '../api'

/** Used only to load the Google Maps JS map widget (tiles), not for geo APIs. */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''

export function locateWithDevice() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not available'))
      return
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        })
      },
      reject,
      {
        enableHighAccuracy: true,
        timeout: 20_000,
        maximumAge: 0,
      },
    )
  })
}

/** Network / IP locate through PrintStack API. */
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

/**
 * Prefer device GPS, then fall back to PrintStack API geolocation.
 */
export async function readTrackedCoords(idToken) {
  try {
    return await locateWithDevice()
  } catch {
    return locateWithApi(idToken)
  }
}
