import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../firestore.js'
import { mapLocation } from '../lib/location.js'

export async function updateMyLocation(req, res) {
  const partnerId = req.profile?.partnerId
  if (!partnerId) {
    res.status(400).json({ error: 'This account is not linked to a partner' })
    return
  }

  const lat = Number(req.body.lat)
  const lng = Number(req.body.lng)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    res.status(400).json({ error: 'A valid latitude and longitude are required' })
    return
  }

  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
    res.status(400).json({ error: 'Location is out of range' })
    return
  }

  const location = {
    lat,
    lng,
    label: String(req.body.label || '').trim().slice(0, 180),
    online: req.body.online !== false,
    updatedAt: FieldValue.serverTimestamp(),
  }

  await db.collection('partners').doc(partnerId).update({ location })

  res.json({
    location: mapLocation({
      ...location,
      updatedAt: new Date(),
    }),
  })
}
