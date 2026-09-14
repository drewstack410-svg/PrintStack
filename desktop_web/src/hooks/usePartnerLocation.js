import { useCallback, useEffect, useRef, useState } from 'react'
import { updateMyLocation } from '../api'
import {
  isAccurateEnough,
  MAX_ACCEPTABLE_ACCURACY_M,
  readTrackedCoords,
  reverseGeocode,
} from '../lib/geo'

const REPORT_MS = 20_000
const MOVE_THRESHOLD_M = 25
const OFFLINE_GRACE_MS = 2500
/** Only a sharp GPS fix can replace a manually pinned shop. */
const GOOD_FIX_FOR_OVERRIDE_M = 75

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

export function usePartnerLocation({ user, enabled, seedLocation = null }) {
  const [location, setLocation] = useState(null)
  const [error, setError] = useState('')
  const lastSent = useRef(null)
  const lastLabel = useRef('')
  const lastAccuracy = useRef(Infinity)
  const pinnedManual = useRef(false)

  useEffect(() => {
    if (!seedLocation || lastSent.current) {
      return
    }
    const lat = Number(seedLocation.lat)
    const lng = Number(seedLocation.lng)
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      return
    }
    lastSent.current = { lat, lng }
    lastLabel.current = seedLocation.label || ''
    lastAccuracy.current = Number(seedLocation.accuracy)
    if (!Number.isFinite(lastAccuracy.current)) {
      // Existing shop pin is trusted until a better GPS fix arrives.
      lastAccuracy.current = 40
    }
    setLocation({
      lat,
      lng,
      label: lastLabel.current,
      online: Boolean(seedLocation.online),
    })
  }, [seedLocation])

  useEffect(() => {
    if (!enabled || !user) {
      return undefined
    }

    const session = ++locationSession
    let cancelled = false

    async function pushLocation({ lat, lng, label, online = true, accuracy }) {
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
      if (Number.isFinite(accuracy)) {
        lastAccuracy.current = accuracy
      }

      if (!cancelled && session === locationSession) {
        setLocation(payload.location || { lat, lng, label, online })
        setError('')
      }
    }

    async function report({ force = false, online = true } = {}) {
      try {
        const token = await user.getIdToken()
        const allowNetworkFallback = !lastSent.current && !pinnedManual.current
        const coords = await readTrackedCoords(token, { allowNetworkFallback })
        const next = { lat: coords.latitude, lng: coords.longitude }
        const accuracy = Number(coords.accuracy)
        const moved = distanceMeters(lastSent.current, next) >= MOVE_THRESHOLD_M

        // Never let coarse IP/network locate yank a known shop pin.
        if (
          lastSent.current &&
          (!isAccurateEnough(coords, MAX_ACCEPTABLE_ACCURACY_M) ||
            (Number.isFinite(accuracy) && accuracy > lastAccuracy.current * 1.5 && moved))
        ) {
          await pushLocation({
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            label: lastLabel.current,
            online,
            accuracy: lastAccuracy.current,
          })
          if (session === locationSession) {
            setError(
              'Using your saved shop pin — OS location is too coarse. Click the map to place it exactly.',
            )
          }
          return
        }

        if (!force && !moved && lastSent.current) {
          await pushLocation({
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            label: lastLabel.current,
            online,
            accuracy: lastAccuracy.current,
          })
          return
        }

        // Manual pin wins until the partner moves far with a sharp GPS fix.
        if (pinnedManual.current && lastSent.current && moved) {
          if (!isAccurateEnough(coords, GOOD_FIX_FOR_OVERRIDE_M)) {
            await pushLocation({
              lat: lastSent.current.lat,
              lng: lastSent.current.lng,
              label: lastLabel.current,
              online,
              accuracy: lastAccuracy.current,
            })
            return
          }
          pinnedManual.current = false
        }

        const label =
          coords.label ||
          (moved || !lastLabel.current
            ? await reverseGeocode(next.lat, next.lng, token)
            : lastLabel.current)

        await pushLocation({ ...next, label, online, accuracy })
      } catch (err) {
        if (lastSent.current && online) {
          await pushLocation({
            lat: lastSent.current.lat,
            lng: lastSent.current.lng,
            label: lastLabel.current,
            online: true,
            accuracy: lastAccuracy.current,
          })
          if (session === locationSession) {
            setError(
              err.message ||
                'Could not refresh GPS — keeping your last shop location. Enable Windows Location, or click the map to place your pin.',
            )
          }
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
          setError(
            err.message ||
              'Could not detect this partner’s location. Click the map to place your shop pin.',
          )
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

  const setManualLocation = useCallback(
    async ({ lat, lng, label }) => {
      if (!user || !Number.isFinite(lat) || !Number.isFinite(lng)) {
        return
      }

      const token = await user.getIdToken()
      const resolvedLabel =
        label ||
        (await reverseGeocode(lat, lng, token)) ||
        lastLabel.current ||
        'Pinned shop location'

      pinnedManual.current = true
      lastAccuracy.current = 5

      const payload = await updateMyLocation(token, {
        lat,
        lng,
        label: resolvedLabel,
        online: true,
      })

      lastSent.current = { lat, lng }
      lastLabel.current = resolvedLabel
      setLocation(payload.location || { lat, lng, label: resolvedLabel, online: true })
      setError('')
      return payload.location
    },
    [user],
  )

  return { location, error, setManualLocation }
}
