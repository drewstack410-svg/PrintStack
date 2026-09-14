import { db } from '../firestore.js'
import { mapLocation } from '../lib/location.js'
import { signedLogoUrl } from '../storage.js'

export async function me(req, res) {
  const profile = { ...req.profile }

  if (profile.partnerId) {
    try {
      const snap = await db.collection('partners').doc(profile.partnerId).get()
      if (snap.exists) {
        const data = snap.data() || {}
        profile.logoUrl = data.logoPath ? await signedLogoUrl(data.logoPath) : data.logoUrl || profile.logoUrl || ''
        profile.logoPath = data.logoPath || profile.logoPath || ''
        profile.location = mapLocation(data.location)
      }
    } catch (error) {
      console.warn('[me] partner lookup failed', error)
    }
  }

  res.json(profile)
}
