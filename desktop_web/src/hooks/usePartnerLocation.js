import { useCallback, useEffect, useRef, useState } from 'react'
import { updateMyLocation } from '../api'
import { locateWithDevice, locateWithApi, reverseGeocode } from '../lib/geo'

const HEARTBEAT_MS = 20_000
const OFFLINE_GRACE_MS = 2500

let locationSession = 0

function toPoint(location) {
  const lat = Number(location?.lat)
  const lng = Number(location?.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    return null
  }
  return {
    lat,
    lng,
    label: location.label || '',
    online: Boolean(location.online),
  }
}

export function usePartnerLocation({ user, enabled, seedLocation = null }) {
  const [location, setLocation] = useState(() => toPoint(seedLocation))
  const [error, setError] = useState('')
  const [locating, setLocating] = useState(false)
  const lastSent = useRef(toPoint(seedLocation))
  const lastLabel = useRef(seedLocation?.label || '')

  useEffect(() => {
    const seeded = toPoint(seedLocation)
    if (!seeded || lastSent.current) {
      return
    }
    lastSent.current = seeded
    lastLabel.current = seeded.label
    setLocation(seeded)
  }, [seedLocation])

  useEffect(() => {
    if (!enabled || !user) {
      return undefined
    }

    const session = ++locationSession
    let cancelled = false

    async function heartbeat(online = true) {
      const snapshot = lastSent.current
      if (!snapshot) {
        return
      }

      const token = await user.getIdToken()
      const payload = await updateMyLocation(token, {
        lat: snapshot.lat,
        lng: snapshot.lng,
        label: lastLabel.current || snapshot.label || '',
        online,
      })

      if (!cancelled && session === locationSession) {
        setLocation(payload.location || { ...snapshot, online })
      }
    }

    heartbeat(true).catch(() => {})
    const timer = window.setInterval(() => {
      heartbeat(true).catch(() => {})
    }, HEARTBEAT_MS)

    return () => {
      cancelled = true
      window.clearInterval(timer)
      const snapshot = lastSent.current
      const label = lastLabel.current
      window.setTimeout(() => {
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

  const savePoint = useCallback(
    async ({ lat, lng, label }) => {
      if (!user || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return null
      }

      const token = await user.getIdToken()
      const resolvedLabel =
        label ||
        (await reverseGeocode(lat, lng, token)) ||
        lastLabel.current ||
        'Shop location'

      const payload = await updateMyLocation(token, {
        lat,
        lng,
        label: resolvedLabel,
        online: true,
      })

      const next = payload.location || { lat, lng, label: resolvedLabel, online: true }
      lastSent.current = { lat: next.lat, lng: next.lng, label: next.label, online: true }
      lastLabel.current = next.label || resolvedLabel
      setLocation(next)
      setError('')
      return next
    },
    [user],
  )

  const setManualLocation = useCallback(
    async ({ lat, lng, label }) => savePoint({ lat, lng, label }),
    [savePoint],
  )

  const useMyLocation = useCallback(async () => {
    if (!user) {
      return null
    }

    setLocating(true)
    setError('')
    try {
      const token = await user.getIdToken()
      let coords
      try {
        coords = await locateWithDevice({ timeoutMs: 20_000, goodAccuracyM: 100 })
      } catch {
        coords = await locateWithApi(token)
      }

      const lat = coords.latitude
      const lng = coords.longitude
      const accuracy = Number(coords.accuracy)
      const next = await savePoint({
        lat,
        lng,
        label: coords.label,
      })

      if (Number.isFinite(accuracy) && accuracy > 150) {
        setError('Location may be approximate — drag the pin to your exact shop.')
      }

      return next
    } catch (err) {
      setError(err.message || 'Could not get your location. Drag the pin instead.')
      throw err
    } finally {
      setLocating(false)
    }
  }, [savePoint, user])

  return { location, error, locating, setManualLocation, useMyLocation }
}
