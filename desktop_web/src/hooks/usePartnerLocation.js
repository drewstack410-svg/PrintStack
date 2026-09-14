import { useEffect, useRef, useState } from 'react'
import { updateMyLocation } from '../api'
import { readTrackedCoords, reverseGeocode } from '../lib/geo'

const REPORT_MS = 30_000
const MOVE_THRESHOLD_M = 25

function distanceMeters(a, b) {
  if (!a || !b) {
    return Infinity
  }

  const toRad = (value) => (value * Math.PI) / 180
  const earth = 6371000
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const lat1 = toRad(a.lat)
  const lat2 = toRad(b.lat)
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2

  return 2 * earth * Math.asin(Math.sqrt(h))
}

export function usePartnerLocation({ user, enabled }) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState('')
  const lastSent = useRef(null)

  useEffect(() => {
    if (!enabled || !user) {
      return undefined
    }

    let cancelled = false

    async function report({ force = false, online = true } = {}) {
      const coords = await readTrackedCoords()
      const next = { lat: coords.latitude, lng: coords.longitude }
      if (!force && distanceMeters(lastSent.current, next) < MOVE_THRESHOLD_M) {
        return
      }

      const label = coords.label || (await reverseGeocode(next.lat, next.lng))
      if (cancelled && online) {
        return
      }

      const token = await user.getIdToken()
      const payload = await updateMyLocation(token, {
        lat: next.lat,
        lng: next.lng,
        label,
        online,
      })
      lastSent.current = next
      if (!cancelled) {
        setLocation(payload.location || { ...next, label, online })
        setError('')
      }
    }

    async function tick(options) {
      try {
        await report(options)
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Could not detect this partner’s location')
        }
      }
    }

    tick({ force: true })
    const timer = window.setInterval(() => tick({ force: true }), REPORT_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      if (lastSent.current) {
        user.getIdToken().then((token) =>
          updateMyLocation(token, {
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            online: false,
          }).catch(() => {}),
        )
      }
    }
  }, [enabled, user])

  return { location, error }
}
