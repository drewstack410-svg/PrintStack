function envValue(...keys) {
  for (const key of keys) {
    const value = String(process.env[key] || '').trim()
    if (value) {
      return value
    }
  }
  return ''
}

function geoapifyApiKey() {
  // Accept VITE_ prefix if someone copied desktop_web/.env into server/.env
  return envValue('GEOAPIFY_API_KEY', 'VITE_GEOAPIFY_API_KEY')
}

function geoapifyCountryCodes() {
  return envValue('GEOAPIFY_COUNTRY_CODES', 'VITE_GEOAPIFY_COUNTRY_CODES') || 'ph'
}

function googleMapsApiKey() {
  return envValue('GOOGLE_MAPS_API_KEY', 'VITE_GOOGLE_MAPS_API_KEY')
}

function featureLabel(properties = {}) {
  return properties.formatted || properties.address_line1 || properties.name || ''
}

function flattenLatLngCoords(coords, out = []) {
  if (!Array.isArray(coords)) {
    return out
  }
  if (typeof coords[0] === 'number' && coords.length >= 2) {
    out.push({ lat: Number(coords[1]), lng: Number(coords[0]) })
    return out
  }
  for (const item of coords) {
    flattenLatLngCoords(item, out)
  }
  return out
}

function requireNumber(value, name) {
  const n = Number(value)
  if (!Number.isFinite(n)) {
    const error = new Error(`${name} must be a number`)
    error.status = 400
    throw error
  }
  return n
}

async function locateWithGoogle(apiKey) {
  const response = await fetch(
    `https://www.googleapis.com/geolocation/v1/geolocate?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ considerIp: true }),
    },
  )
  const payload = await response.json()
  const lat = Number(payload.location?.lat)
  const lng = Number(payload.location?.lng)
  if (!response.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(payload.error?.message || 'Google could not locate this device')
  }
  return { lat, lng, source: 'google' }
}

async function locateWithGeoapify(apiKey) {
  const response = await fetch(`https://api.geoapify.com/v1/ipinfo?apiKey=${apiKey}`)
  const payload = await response.json()
  const lat = Number(payload.location?.latitude)
  const lng = Number(payload.location?.longitude)
  if (!response.ok || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(payload.message || 'Geoapify could not locate this device')
  }
  return {
    lat,
    lng,
    label: [payload.city?.name, payload.state?.name, payload.country?.name]
      .filter(Boolean)
      .join(', '),
    source: 'geoapify',
  }
}

async function reverseGeocode(lat, lng) {
  const apiKey = geoapifyApiKey()
  if (!apiKey) {
    return ''
  }

  const countryCodes = String(geoapifyCountryCodes()).toLowerCase()
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    apiKey,
    lang: 'en',
  })
  if (countryCodes) {
    params.set('filter', `countrycode:${countryCodes}`)
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

function decodeGooglePolyline(encoded) {
  const coordinates = []
  let index = 0
  let lat = 0
  let lng = 0

  while (index < encoded.length) {
    let result = 0
    let shift = 0
    let b
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlat = result & 1 ? ~(result >> 1) : result >> 1
    lat += dlat

    result = 0
    shift = 0
    do {
      b = encoded.charCodeAt(index++) - 63
      result |= (b & 0x1f) << shift
      shift += 5
    } while (b >= 0x20)
    const dlng = result & 1 ? ~(result >> 1) : result >> 1
    lng += dlng

    coordinates.push({ lat: lat / 1e5, lng: lng / 1e5 })
  }

  return coordinates
}

async function routeWithGeoapify(fromLat, fromLng, toLat, toLng, apiKey) {
  const params = new URLSearchParams({
    waypoints: `${fromLat},${fromLng}|${toLat},${toLng}`,
    mode: 'drive',
    apiKey,
  })
  const response = await fetch(`https://api.geoapify.com/v1/routing?${params}`)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message || 'Geoapify routing failed')
  }

  const feature = payload.features?.[0]
  const points = flattenLatLngCoords(feature?.geometry?.coordinates)

  const distanceMeters = Number(feature?.properties?.distance) || 0
  const timeSeconds = Number(feature?.properties?.time) || 0
  return {
    points: points.length >= 2 ? points : [
      { lat: fromLat, lng: fromLng },
      { lat: toLat, lng: toLng },
    ],
    distanceText: distanceMeters
      ? distanceMeters >= 1000
        ? `${(distanceMeters / 1000).toFixed(1)} km`
        : `${Math.round(distanceMeters)} m`
      : '',
    durationText: timeSeconds
      ? timeSeconds >= 3600
        ? `${Math.floor(timeSeconds / 3600)} hr ${Math.round((timeSeconds % 3600) / 60)} min`
        : `${Math.max(1, Math.round(timeSeconds / 60))} min`
      : '',
    source: 'geoapify',
  }
}

async function routeWithGoogle(fromLat, fromLng, toLat, toLng, apiKey) {
  const params = new URLSearchParams({
    origin: `${fromLat},${fromLng}`,
    destination: `${toLat},${toLng}`,
    mode: 'driving',
    key: apiKey,
  })
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`,
  )
  const payload = await response.json()
  if (payload.status !== 'OK') {
    throw new Error(payload.error_message || `Google directions ${payload.status}`)
  }

  const route = payload.routes?.[0]
  const encoded = route?.overview_polyline?.points || ''
  const points = encoded
    ? decodeGooglePolyline(encoded)
    : [
        { lat: fromLat, lng: fromLng },
        { lat: toLat, lng: toLng },
      ]
  const leg = route?.legs?.[0]
  return {
    points,
    distanceText: leg?.distance?.text || '',
    durationText: leg?.duration?.text || '',
    source: 'google',
  }
}

async function locate(req, res) {
  try {
    const googleKey = googleMapsApiKey()
    const geoapifyKey = geoapifyApiKey()

    let location = null
    let lastError = null

    if (googleKey) {
      try {
        location = await locateWithGoogle(googleKey)
      } catch (error) {
        lastError = error
      }
    }

    if (!location && geoapifyKey) {
      try {
        location = await locateWithGeoapify(geoapifyKey)
      } catch (error) {
        lastError = error
      }
    }

    if (!location) {
      res.status(502).json({
        error: lastError?.message || 'Geolocation is not configured on the server',
      })
      return
    }

    if (!location.label) {
      location.label = await reverseGeocode(location.lat, location.lng)
    }

    res.json({ location })
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Locate failed' })
  }
}

async function reverse(req, res) {
  try {
    const lat = requireNumber(req.query.lat, 'lat')
    const lng = requireNumber(req.query.lng, 'lng')
    const label = await reverseGeocode(lat, lng)
    res.json({ label, lat, lng })
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Reverse geocode failed' })
  }
}

async function autocomplete(req, res) {
  try {
    const query = String(req.query.q || req.query.text || '').trim()
    if (query.length < 2) {
      res.json({ results: [] })
      return
    }

    const apiKey = geoapifyApiKey()
    if (!apiKey) {
      res.status(502).json({ error: 'Geocoding is not configured on the server' })
      return
    }

    const countryCodes = String(geoapifyCountryCodes()).toLowerCase()
    const params = new URLSearchParams({
      text: query,
      apiKey,
      limit: '8',
      lang: 'en',
    })
    if (countryCodes) {
      params.set('filter', `countrycode:${countryCodes}`)
    }

    const response = await fetch(
      `https://api.geoapify.com/v1/geocode/autocomplete?${params}`,
    )
    const payload = await response.json()
    if (!response.ok) {
      throw new Error(payload.message || 'Autocomplete failed')
    }

    const results = (payload.features || [])
      .map((feature) => {
        const properties = feature.properties || {}
        const [lng, lat] = feature.geometry?.coordinates || []
        const parsedLat = Number(lat)
        const parsedLng = Number(lng)
        if (!Number.isFinite(parsedLat) || !Number.isFinite(parsedLng)) {
          return null
        }
        return {
          id: properties.place_id || `${parsedLat},${parsedLng}`,
          label: featureLabel(properties),
          lat: parsedLat,
          lng: parsedLng,
        }
      })
      .filter(Boolean)

    res.json({ results })
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Autocomplete failed',
    })
  }
}

async function route(req, res) {
  try {
    const fromLat = requireNumber(req.query.fromLat ?? req.body?.fromLat, 'fromLat')
    const fromLng = requireNumber(req.query.fromLng ?? req.body?.fromLng, 'fromLng')
    const toLat = requireNumber(req.query.toLat ?? req.body?.toLat, 'toLat')
    const toLng = requireNumber(req.query.toLng ?? req.body?.toLng, 'toLng')

    const geoapifyKey = geoapifyApiKey()
    const googleKey = googleMapsApiKey()

    let result = null
    let lastError = null

    if (geoapifyKey) {
      try {
        result = await routeWithGeoapify(fromLat, fromLng, toLat, toLng, geoapifyKey)
      } catch (error) {
        lastError = error
      }
    }

    if (!result && googleKey) {
      try {
        result = await routeWithGoogle(fromLat, fromLng, toLat, toLng, googleKey)
      } catch (error) {
        lastError = error
      }
    }

    if (!result) {
      // Still return a usable straight line so the mobile map can draw something.
      result = {
        points: [
          { lat: fromLat, lng: fromLng },
          { lat: toLat, lng: toLng },
        ],
        distanceText: '',
        durationText: '',
        source: 'fallback',
        warning: lastError?.message || 'Routing providers unavailable',
      }
    }

    res.json({ route: result })
  } catch (error) {
    res.status(error.status || 500).json({ error: error.message || 'Route failed' })
  }
}

module.exports = {
  locate,
  reverse,
  autocomplete,
  route,
}
