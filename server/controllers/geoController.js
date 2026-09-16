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

function formatDuration(seconds) {
  const timeSeconds = Number(seconds) || 0
  if (!timeSeconds) {
    return ''
  }
  if (timeSeconds >= 3600) {
    return `${Math.floor(timeSeconds / 3600)} hr ${Math.round((timeSeconds % 3600) / 60)} min`
  }
  return `${Math.max(1, Math.round(timeSeconds / 60))} min`
}

function formatDistance(meters) {
  const distanceMeters = Number(meters) || 0
  if (!distanceMeters) {
    return ''
  }
  if (distanceMeters >= 1000) {
    return `${(distanceMeters / 1000).toFixed(1)} km`
  }
  return `${Math.round(distanceMeters)} m`
}

function trafficLevelFromDurations(baseSeconds, trafficSeconds) {
  const base = Number(baseSeconds) || 0
  const traffic = Number(trafficSeconds) || base
  if (!base || !traffic) {
    return 'unknown'
  }
  const ratio = traffic / base
  if (ratio < 1.15) {
    return 'light'
  }
  if (ratio < 1.4) {
    return 'moderate'
  }
  return 'heavy'
}

function parseDurationSeconds(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  const match = String(value || '').match(/^(\d+(?:\.\d+)?)s$/i)
  return match ? Number(match[1]) : 0
}

function normalizeTravelMode(raw) {
  const value = String(raw || 'drive').trim().toLowerCase()
  if (['walk', 'walking', 'pedestrian'].includes(value)) {
    return 'walk'
  }
  if (['bike', 'bicycle', 'bicycling', 'cycling'].includes(value)) {
    return 'bicycle'
  }
  if (['transit', 'bus', 'train', 'public'].includes(value)) {
    return 'transit'
  }
  if (['two_wheeler', 'motorcycle', 'motorbike'].includes(value)) {
    return 'two_wheeler'
  }
  return 'drive'
}

function normalizeGoogleRoutesMode(raw) {
  switch (normalizeTravelMode(raw)) {
    case 'walk':
      return 'WALK'
    case 'bicycle':
      return 'BICYCLE'
    case 'transit':
      return 'TRANSIT'
    case 'two_wheeler':
      return 'TWO_WHEELER'
    default:
      return 'DRIVE'
  }
}

function normalizeGoogleDirectionsMode(raw) {
  switch (normalizeTravelMode(raw)) {
    case 'walk':
      return 'walking'
    case 'bicycle':
      return 'bicycling'
    case 'transit':
      return 'transit'
    default:
      return 'driving'
  }
}

function normalizeGeoapifyMode(raw) {
  switch (normalizeTravelMode(raw)) {
    case 'walk':
      return 'walk'
    case 'bicycle':
      return 'bicycle'
    case 'transit':
      return 'transit'
    default:
      return 'drive'
  }
}

async function routeWithGoogleRoutesApi(fromLat, fromLng, toLat, toLng, apiKey, travelMode = 'DRIVE') {
  const mode = normalizeGoogleRoutesMode(travelMode)
  const body = {
    origin: {
      location: { latLng: { latitude: fromLat, longitude: fromLng } },
    },
    destination: {
      location: { latLng: { latitude: toLat, longitude: toLng } },
    },
    travelMode: mode,
    polylineQuality: 'HIGH_QUALITY',
    computeAlternativeRoutes: false,
    languageCode: 'en-US',
    units: 'METRIC',
  }
  if (mode === 'DRIVE' || mode === 'TWO_WHEELER') {
    body.routingPreference = 'TRAFFIC_AWARE'
  }

  const response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': [
        'routes.duration',
        'routes.staticDuration',
        'routes.distanceMeters',
        'routes.polyline.encodedPolyline',
        'routes.legs.polyline.encodedPolyline',
      ].join(','),
    },
    body: JSON.stringify(body),
  })

  const payload = await response.json()
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Google Routes API HTTP ${response.status}`,
    )
  }

  const route = payload.routes?.[0]
  if (!route) {
    throw new Error('Google Routes API returned no routes')
  }

  let encoded = route.polyline?.encodedPolyline || ''
  if (!encoded) {
    encoded = route.legs?.[0]?.polyline?.encodedPolyline || ''
  }

  const points = encoded ? decodeGooglePolyline(encoded) : []
  if (points.length < 2) {
    throw new Error('Google Routes API returned an empty polyline')
  }

  const trafficSeconds = parseDurationSeconds(route.duration)
  const staticSeconds = parseDurationSeconds(route.staticDuration) || trafficSeconds
  const distanceMeters = Number(route.distanceMeters) || 0

  return {
    points,
    distanceText: formatDistance(distanceMeters),
    durationText: formatDuration(staticSeconds),
    durationInTrafficText: formatDuration(trafficSeconds),
    trafficLevel: trafficLevelFromDurations(staticSeconds, trafficSeconds),
    hasTraffic: Boolean(route.duration) && (mode === 'DRIVE' || mode === 'TWO_WHEELER'),
    travelMode: mode,
    source: 'google_routes',
  }
}

async function routeWithGeoapify(fromLat, fromLng, toLat, toLng, apiKey, travelMode = 'drive') {
  const mode = normalizeGeoapifyMode(travelMode)
  const params = new URLSearchParams({
    waypoints: `${fromLat},${fromLng}|${toLat},${toLng}`,
    mode,
    traffic: mode === 'drive' ? 'approximated' : 'free_flow',
    apiKey,
  })
  const response = await fetch(`https://api.geoapify.com/v1/routing?${params}`)
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.message || 'Geoapify routing failed')
  }

  const feature = payload.features?.[0]
  const points = flattenLatLngCoords(feature?.geometry?.coordinates)
  if (points.length < 2) {
    throw new Error('Geoapify returned an empty route')
  }

  const distanceMeters = Number(feature?.properties?.distance) || 0
  const timeSeconds = Number(feature?.properties?.time) || 0
  return {
    points,
    distanceText: formatDistance(distanceMeters),
    durationText: formatDuration(timeSeconds),
    durationInTrafficText: formatDuration(timeSeconds),
    trafficLevel: 'unknown',
    hasTraffic: mode === 'drive',
    travelMode: mode,
    source: 'geoapify',
  }
}

async function routeWithGoogleDirections(fromLat, fromLng, toLat, toLng, apiKey, travelMode = 'driving') {
  const mode = normalizeGoogleDirectionsMode(travelMode)
  const params = new URLSearchParams({
    origin: `${fromLat},${fromLng}`,
    destination: `${toLat},${toLng}`,
    mode,
    key: apiKey,
  })
  if (mode === 'driving') {
    params.set('departure_time', 'now')
    params.set('traffic_model', 'best_guess')
  }
  const response = await fetch(
    `https://maps.googleapis.com/maps/api/directions/json?${params}`,
  )
  const payload = await response.json()
  if (payload.status !== 'OK') {
    throw new Error(payload.error_message || `Google directions ${payload.status}`)
  }

  const route = payload.routes?.[0]
  const leg = route?.legs?.[0]
  const points = []

  for (const step of leg?.steps || []) {
    const encoded = step?.polyline?.points
    if (encoded) {
      points.push(...decodeGooglePolyline(encoded))
    }
  }

  if (points.length < 2) {
    const overview = route?.overview_polyline?.points || ''
    if (overview) {
      points.push(...decodeGooglePolyline(overview))
    }
  }

  if (points.length < 2) {
    throw new Error('Google directions returned an empty route')
  }

  const baseSeconds = Number(leg?.duration?.value) || 0
  const trafficSeconds = Number(leg?.duration_in_traffic?.value) || baseSeconds

  return {
    points,
    distanceText: leg?.distance?.text || formatDistance(leg?.distance?.value),
    durationText: leg?.duration?.text || formatDuration(baseSeconds),
    durationInTrafficText:
      leg?.duration_in_traffic?.text || formatDuration(trafficSeconds),
    trafficLevel: trafficLevelFromDurations(baseSeconds, trafficSeconds),
    hasTraffic: Boolean(leg?.duration_in_traffic),
    travelMode: mode,
    source: 'google_directions',
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

async function autocompleteWithPlaces(query, sessionToken, apiKey) {
  const countryCodes = String(geoapifyCountryCodes() || 'ph')
    .toLowerCase()
    .split(',')
    .map((code) => code.trim())
    .filter(Boolean)

  const body = {
    input: query,
    languageCode: 'en',
    includeQueryPredictions: false,
  }
  if (countryCodes.length) {
    body.includedRegionCodes = countryCodes
  }
  if (sessionToken) {
    body.sessionToken = sessionToken
  }

  const response = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask':
        'suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || `Places autocomplete HTTP ${response.status}`)
  }

  return (payload.suggestions || [])
    .map((suggestion) => {
      const prediction = suggestion.placePrediction
      if (!prediction?.placeId) {
        return null
      }
      const main = prediction.structuredFormat?.mainText?.text || ''
      const secondary = prediction.structuredFormat?.secondaryText?.text || ''
      const label =
        prediction.text?.text ||
        [main, secondary].filter(Boolean).join(', ') ||
        prediction.placeId
      return {
        id: prediction.placeId,
        placeId: prediction.placeId,
        label,
        sessionToken: sessionToken || '',
        source: 'places',
      }
    })
    .filter(Boolean)
}

async function autocompleteWithGeoapify(query, apiKey) {
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
    throw new Error(payload.message || 'Geoapify autocomplete failed')
  }

  return (payload.features || [])
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
        placeId: properties.place_id || '',
        label: featureLabel(properties),
        lat: parsedLat,
        lng: parsedLng,
        source: 'geoapify',
      }
    })
    .filter(Boolean)
}

function normalizePlaceId(placeId) {
  return String(placeId || '')
    .trim()
    .replace(/^places\//, '')
}

async function placeDetails(placeId, sessionToken, apiKey) {
  const id = normalizePlaceId(placeId)
  if (!id) {
    throw Object.assign(new Error('placeId is required'), { status: 400 })
  }

  const params = new URLSearchParams()
  if (sessionToken) {
    params.set('sessionToken', sessionToken)
  }
  const qs = params.toString()
  const response = await fetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}${qs ? `?${qs}` : ''}`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'id,formattedAddress,displayName,location',
      },
    },
  )
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(payload.error?.message || `Place details HTTP ${response.status}`)
  }

  const lat = Number(payload.location?.latitude)
  const lng = Number(payload.location?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Place details returned no coordinates')
  }

  return {
    lat,
    lng,
    label:
      payload.formattedAddress ||
      payload.displayName?.text ||
      id,
    placeId: normalizePlaceId(payload.id) || id,
    source: 'places_details',
    validated: false,
  }
}

async function validateAddressWithGoogle({ address, regionCode, sessionToken, apiKey }) {
  const lines = Array.isArray(address)
    ? address.map((line) => String(line || '').trim()).filter(Boolean)
    : [String(address || '').trim()].filter(Boolean)

  if (!lines.length) {
    throw Object.assign(new Error('Address is required'), { status: 400 })
  }

  const body = {
    address: {
      regionCode: String(regionCode || 'PH').toUpperCase(),
      addressLines: lines,
    },
  }
  if (sessionToken) {
    body.sessionToken = sessionToken
  }

  const response = await fetch(
    'https://addressvalidation.googleapis.com/v1:validateAddress',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
      },
      body: JSON.stringify(body),
    },
  )
  const payload = await response.json()
  if (!response.ok) {
    throw new Error(
      payload.error?.message || `Address validation HTTP ${response.status}`,
    )
  }

  const result = payload.result || {}
  const geocode = result.geocode || {}
  const lat = Number(geocode.location?.latitude)
  const lng = Number(geocode.location?.longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error('Address validation returned no coordinates')
  }

  const verdict = result.verdict || {}
  const label =
    result.address?.formattedAddress ||
    lines.join(', ')

  return {
    lat,
    lng,
    label,
    placeId: geocode.placeId || '',
    source: 'address_validation',
    validated: true,
    verdict: {
      inputGranularity: verdict.inputGranularity || '',
      validationGranularity: verdict.validationGranularity || '',
      geocodeGranularity: verdict.geocodeGranularity || '',
      addressComplete: Boolean(verdict.addressComplete),
      hasUnconfirmedComponents: Boolean(verdict.hasUnconfirmedComponents),
      hasInferredComponents: Boolean(verdict.hasInferredComponents),
    },
  }
}

async function autocomplete(req, res) {
  try {
    const query = String(req.query.q || req.query.text || '').trim()
    if (query.length < 2) {
      res.json({ results: [] })
      return
    }

    const sessionToken = String(req.query.sessionToken || req.body?.sessionToken || '').trim()
    const googleKey = googleMapsApiKey()
    const geoapifyKey = geoapifyApiKey()
    const errors = []

    if (!googleKey && !geoapifyKey) {
      res.status(502).json({
        error:
          'Place search is not configured. Set GOOGLE_MAPS_API_KEY (Places API New) or GEOAPIFY_API_KEY on the API server / Vercel env.',
      })
      return
    }

    if (googleKey) {
      try {
        const results = await autocompleteWithPlaces(query, sessionToken, googleKey)
        res.json({ results, source: 'places' })
        return
      } catch (error) {
        errors.push(`places: ${error.message}`)
        console.warn('[geo/autocomplete] Places API failed:', error.message)
      }
    }

    if (geoapifyKey) {
      try {
        const results = await autocompleteWithGeoapify(query, geoapifyKey)
        res.json({ results, source: 'geoapify' })
        return
      } catch (error) {
        errors.push(`geoapify: ${error.message}`)
        console.warn('[geo/autocomplete] Geoapify failed:', error.message)
      }
    }

    res.status(502).json({
      error: errors.join(' | ') || 'Place search failed',
    })
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Autocomplete failed',
    })
  }
}

/** Resolve a Places suggestion into validated coordinates. */
async function resolvePlace(req, res) {
  try {
    const placeId = String(req.body?.placeId || req.query.placeId || '').trim()
    const address = String(req.body?.address || req.query.address || '').trim()
    const sessionToken = String(
      req.body?.sessionToken || req.query.sessionToken || '',
    ).trim()
    const regionCode = String(
      req.body?.regionCode || geoapifyCountryCodes() || 'ph',
    )
      .split(',')[0]
      .trim()
      .toUpperCase() || 'PH'

    const googleKey = googleMapsApiKey()
    const geoapifyKey = geoapifyApiKey()
    if (!googleKey && !geoapifyKey) {
      res.status(502).json({
        error:
          'Place resolve is not configured. Set GOOGLE_MAPS_API_KEY on the API server.',
      })
      return
    }

    const errors = []

    // Prefer Place Details — Address Validation does not support PH and many regions.
    if (placeId && googleKey) {
      try {
        const details = await placeDetails(placeId, sessionToken, googleKey)
        res.json({ place: details })
        return
      } catch (error) {
        errors.push(`details: ${error.message}`)
        console.warn('[geo/resolve-place] Place Details failed:', error.message)
      }
    }

    // Address Validation only for supported regions (not PH).
    const addressValidationUnsupported = new Set(['PH', 'CN', 'KR', 'JP'])
    if (address && googleKey && !addressValidationUnsupported.has(regionCode)) {
      try {
        const validated = await validateAddressWithGoogle({
          address,
          regionCode,
          sessionToken,
          apiKey: googleKey,
        })
        res.json({ place: validated })
        return
      } catch (error) {
        errors.push(`validation: ${error.message}`)
        console.warn('[geo/resolve-place] Address Validation failed:', error.message)
      }
    }

    // Last resort: coords already on the suggestion (e.g. Geoapify autocomplete).
    const lat = Number(req.body?.lat)
    const lng = Number(req.body?.lng)
    if (Number.isFinite(lat) && Number.isFinite(lng)) {
      res.json({
        place: {
          lat,
          lng,
          label: address || `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
          placeId,
          source: 'client',
          validated: false,
        },
      })
      return
    }

    res.status(502).json({
      error: errors.join(' | ') || 'Could not resolve this place',
    })
  } catch (error) {
    res.status(error.status || 500).json({
      error: error.message || 'Could not resolve place',
    })
  }
}

async function route(req, res) {
  try {
    const fromLat = requireNumber(req.query.fromLat ?? req.body?.fromLat, 'fromLat')
    const fromLng = requireNumber(req.query.fromLng ?? req.body?.fromLng, 'fromLng')
    const toLat = requireNumber(req.query.toLat ?? req.body?.toLat, 'toLat')
    const toLng = requireNumber(req.query.toLng ?? req.body?.toLng, 'toLng')
    const travelMode = normalizeTravelMode(
      req.query.mode ?? req.query.travelMode ?? req.body?.mode ?? req.body?.travelMode,
    )

    const geoapifyKey = geoapifyApiKey()
    const googleKey = googleMapsApiKey()

    let result = null
    const errors = []

    // Prefer Google Routes API (new) — works with modern key restrictions + traffic.
    if (googleKey) {
      try {
        result = await routeWithGoogleRoutesApi(
          fromLat,
          fromLng,
          toLat,
          toLng,
          googleKey,
          travelMode,
        )
      } catch (error) {
        errors.push(`routes: ${error.message}`)
        console.warn('[geo/route] Google Routes API failed:', error.message)
      }
    }

    if (!result && googleKey) {
      try {
        result = await routeWithGoogleDirections(
          fromLat,
          fromLng,
          toLat,
          toLng,
          googleKey,
          travelMode,
        )
      } catch (error) {
        errors.push(`directions: ${error.message}`)
        console.warn('[geo/route] Google Directions failed:', error.message)
      }
    }

    if (!result && geoapifyKey) {
      try {
        result = await routeWithGeoapify(
          fromLat,
          fromLng,
          toLat,
          toLng,
          geoapifyKey,
          travelMode,
        )
      } catch (error) {
        errors.push(`geoapify: ${error.message}`)
        console.warn('[geo/route] Geoapify failed:', error.message)
      }
    }

    if (!result) {
      result = {
        points: [
          { lat: fromLat, lng: fromLng },
          { lat: toLat, lng: toLng },
        ],
        distanceText: '',
        durationText: '',
        durationInTrafficText: '',
        trafficLevel: 'unknown',
        hasTraffic: false,
        source: 'fallback',
        warning: errors.join(' | ') || 'Routing providers unavailable',
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
  resolvePlace,
  route,
}
