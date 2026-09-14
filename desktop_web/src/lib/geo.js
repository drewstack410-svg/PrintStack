export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || ''
export const GEOAPIFY_API_KEY = import.meta.env.VITE_GEOAPIFY_API_KEY || ''
export const GEOAPIFY_COUNTRY_CODES = String(import.meta.env.VITE_GEOAPIFY_COUNTRY_CODES || 'ph').toLowerCase()

function featureLabel(properties = {}) {
  return properties.formatted || properties.address_line1 || properties.name || ''
}

export async function locateWithGoogle() {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error('Google Maps API key is missing')
  }

  const response = await fetch(`https://www.googleapis.com/geolocation/v1/geolocate?key=${GOOGLE_MAPS_API_KEY}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ considerIp: true }),
  })
  const payload = await response.json()
  const latitude = Number(payload.location?.lat)
  const longitude = Number(payload.location?.lng)

  if (!response.ok || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(payload.error?.message || 'Google could not locate this device')
  }

  return { latitude, longitude }
}

export async function locateWithGeoapifyIp() {
  if (!GEOAPIFY_API_KEY) {
    throw new Error('Geoapify API key is missing')
  }

  const response = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${GEOAPIFY_API_KEY}`)
  const payload = await response.json()
  const latitude = Number(payload.location?.latitude)
  const longitude = Number(payload.location?.longitude)

  if (!response.ok || !Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    throw new Error(payload.message || 'Geoapify could not locate this device')
  }

  return {
    latitude,
    longitude,
    label: [payload.city?.name, payload.state?.name, payload.country?.name].filter(Boolean).join(', '),
  }
}

export async function reverseGeocode(lat, lng) {
  if (!GEOAPIFY_API_KEY || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    return ''
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    apiKey: GEOAPIFY_API_KEY,
    lang: 'en',
  })

  if (GEOAPIFY_COUNTRY_CODES) {
    params.set('filter', `countrycode:${GEOAPIFY_COUNTRY_CODES}`)
  }

  const response = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`)
  const payload = await response.json()
  const filtered = featureLabel(payload.features?.[0]?.properties)
  if (filtered) {
    return filtered
  }

  params.delete('filter')
  const fallback = await fetch(`https://api.geoapify.com/v1/geocode/reverse?${params}`)
  const fallbackPayload = await fallback.json()
  return featureLabel(fallbackPayload.features?.[0]?.properties)
}

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

export async function readTrackedCoords() {
  try {
    return await locateWithDevice()
  } catch {
    try {
      return await locateWithGoogle()
    } catch {
      return locateWithGeoapifyIp()
    }
  }
}
