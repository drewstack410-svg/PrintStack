const LOCAL_API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:3001'
const VERCEL_API_URL = import.meta.env.VITE_VERCEL_API_URL || ''

export const USE_VERCEL = ['1', 'true', 'yes'].includes(
  String(import.meta.env.VITE_USE_VERCEL || 'false').toLowerCase(),
)

export const API_URL = USE_VERCEL
  ? VERCEL_API_URL || LOCAL_API_URL
  : LOCAL_API_URL

export function getDesktopApi() {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.printstack
}

export async function fetchMe(idToken) {
  const response = await fetch(`${API_URL}/api/me`, {
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
  })

  if (!response.ok) {
    throw new Error('Could not verify session')
  }

  return response.json()
}

async function authorizedJson(path, idToken, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${idToken}`,
      ...(options.headers || {}),
    },
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Request failed')
  }

  return payload
}

export function updateMyLocation(idToken, body) {
  return authorizedJson('/api/me/location', idToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function listPartners(idToken) {
  return authorizedJson('/api/partners', idToken)
}

export async function createPartner(idToken, formData) {
  const response = await fetch(`${API_URL}/api/partners`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Could not create partner')
  }

  return payload
}

export async function updatePartner(idToken, id, formData) {
  const response = await fetch(`${API_URL}/api/partners/${id}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${idToken}`,
    },
    body: formData,
  })

  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || 'Could not update partner')
  }

  return payload
}

export function deletePartner(idToken, id) {
  return authorizedJson(`/api/partners/${id}`, idToken, {
    method: 'DELETE',
  })
}

export function listStaffs(idToken) {
  return authorizedJson('/api/staffs', idToken)
}

export function createStaff(idToken, body) {
  return authorizedJson('/api/staffs', idToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updateStaff(idToken, id, body) {
  return authorizedJson(`/api/staffs/${id}`, idToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deleteStaff(idToken, id) {
  return authorizedJson(`/api/staffs/${id}`, idToken, {
    method: 'DELETE',
  })
}

export function listPaperSizes(idToken) {
  return authorizedJson('/api/paper-sizes', idToken)
}

export function createPaperSize(idToken, body) {
  return authorizedJson('/api/paper-sizes', idToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updatePaperSize(idToken, id, body) {
  return authorizedJson(`/api/paper-sizes/${id}`, idToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function deletePaperSize(idToken, id) {
  return authorizedJson(`/api/paper-sizes/${id}`, idToken, {
    method: 'DELETE',
  })
}

export function listPrintJobs(idToken) {
  return authorizedJson('/api/print-jobs', idToken)
}

export function createPrintJob(idToken, body) {
  return authorizedJson('/api/print-jobs', idToken, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function updatePrintJob(idToken, id, body) {
  return authorizedJson(`/api/print-jobs/${id}`, idToken, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function locateViaApi(idToken) {
  return authorizedJson('/api/geo/locate', idToken, {
    method: 'POST',
  })
}

export function reverseGeocodeViaApi(idToken, lat, lng) {
  const params = new URLSearchParams({
    lat: String(lat),
    lng: String(lng),
  })
  return authorizedJson(`/api/geo/reverse?${params}`, idToken)
}

export function fetchRouteViaApi(idToken, { fromLat, fromLng, toLat, toLng }) {
  const params = new URLSearchParams({
    fromLat: String(fromLat),
    fromLng: String(fromLng),
    toLat: String(toLat),
    toLng: String(toLng),
  })
  return authorizedJson(`/api/geo/route?${params}`, idToken)
}
