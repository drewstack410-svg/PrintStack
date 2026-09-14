import { useEffect, useRef, useState } from 'react'
import { updateMyLocation } from '../api'
import { readTrackedCoords, reverseGeocode } from '../lib/geo'

const REPORT_MS = 20_000
const MOVE_THRESHOLD_M = 25
const OFFLINE_GRACE_MS = 2500

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

let locationSession = 0

export function usePartnerLocation({ user, enabled }) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState('')
  const lastSent = useRef(null)
  const lastLabel = useRef('')

  useEffect(() => {
    if (!enabled || !user) {
      return undefined
    }

    const session = ++locationSession
    let cancelled = false

    async function pushLocation({ lat, lng, label, online = true }) {
      if (cancelled && online) {
        return
      }

      const token = await user.getIdToken()
      const payload = await updateMyLocation(token, {
        lat,
        lng,
        label: label || lastLabel.current || '',
        online,
      })

      lastSent.current = { lat, lng }
      if (label) {
        lastLabel.current = label
      }

      if (!cancelled && session === locationSession) {
        setLocation(payload.location || { lat, lng, label, online })
        setError('')
      }
    }

    async function report({ force = false, online = true } = {}) {
      try {
        const coords = await readTrackedCoords()
        const next = { lat: coords.latitude, lng: coords.longitude }
        const moved = distanceMeters(lastSent.current, next) >= MOVE_THRESHOLD_M

        if (!force && !moved && lastSent.current) {
          // Still heartbeat online status with last known point.
          await pushLocation({
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            label: lastLabel.current,
            online,
          })
          return
        }

        const label =
          coords.label ||
          (moved || !lastLabel.current
            ? await reverseGeocode(next.lat, next.lng)
            : lastLabel.current)

        await pushLocation({ ...next, label, online })
      } catch (err) {
        if (lastSent.current && online) {
          // Geo failed, but keep the partner online with the last good point.
          await pushLocation({
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            label: lastLabel.current,
            online: true,
          })
          return
        }
        throw err
      }
    }

    async function tick(options) {
      try {
        await report(options)
      } catch (err) {
        if (!cancelled && session === locationSession) {
          setError(err.message || 'Could not detect this partner’s location')
        }
      }
    }

    tick({ force: true })
    const timer = window.setInterval(() => tick({ force: true }), REPORT_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      const snapshot = lastSent.current
      const label = lastLabel.current
      window.setTimeout(() => {
        // Skip offline flip if a new tracking session started (HMR / remount).
        if (session !== locationSession || !snapshot) {
          return
        }
        user
          .getIdToken()
          .then((token) =>
            updateMyLocation(token, {
              lat: snapshot.lat,
              lng: snapshot.lng,
              label,
              online: false,
            }),
          )
          .catch(() => {})
      }, OFFLINE_GRACE_MS)
    }
  }, [enabled, user])

  return { location, error }
}
