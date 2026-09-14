const { getAuth } = require('firebase-admin/auth')
const { FieldValue } = require('firebase-admin/firestore')
const firebaseApp = require('../firebaseAdmin')
const { db } = require('../firestore')
const { ADMIN_ROLE, STAFF_ROLE } = require('../models/user')
const { mapLocation } = require('../lib/location')
const { DEFAULT_PAPER_SIZES } = require('../lib/paperSizes')
const { deletePartnerLogo, signedLogoUrl, uploadPartnerLogo } = require('../storage')

function mapPartner(doc, logoUrl = '') {
  const data = doc.data() || {}
  return {
    id: doc.id,
    companyName: data.companyName || '',
    email: data.email || '',
    logoUrl: logoUrl || data.logoUrl || '',
    ownerUid: data.ownerUid || '',
    staffUids: Array.isArray(data.staffUids) ? data.staffUids : [],
    location: mapLocation(data.location),
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
  }
}

async function withLogo(doc) {
  const data = doc.data() || {}
  const logoUrl = data.logoPath ? await signedLogoUrl(data.logoPath) : data.logoUrl || ''
  return mapPartner(doc, logoUrl)
}

async function listPartners(_req, res) {
  const snap = await db.collection('partners').orderBy('createdAt', 'desc').get()
  const partners = await Promise.all(snap.docs.map(withLogo))
  res.json({ partners })
}

async function createPartner(req, res) {
  const companyName = String(req.body.companyName || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!companyName || !email || !password) {
    res.status(400).json({ error: 'Company name, email, and password are required' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const auth = getAuth(firebaseApp)
  let user

  try {
    user = await auth.createUser({
      email,
      password,
      displayName: companyName,
    })

    const partnerRef = db.collection('partners').doc()
    let logoPath = ''
    let logoUrl = ''

    if (req.file) {
      const uploaded = await uploadPartnerLogo(partnerRef.id, req.file)
      logoPath = uploaded.logoPath
      logoUrl = uploaded.logoUrl
    }

    const partnerDoc = {
      companyName,
      email,
      logoPath,
      logoUrl,
      ownerUid: user.uid,
      staffUids: [],
      paperSizes: DEFAULT_PAPER_SIZES.map((size) => ({ ...size })),
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
    }

    const userDoc = {
      uid: user.uid,
      email,
      role: ADMIN_ROLE,
      partnerId: partnerRef.id,
      ownerUid: user.uid,
      companyName,
      logoPath,
      logoUrl,
      staffUids: [],
    }

    const batch = db.batch()
    batch.set(partnerRef, partnerDoc)
    batch.set(db.collection('users').doc(user.uid), userDoc)
    await batch.commit()

    const snap = await partnerRef.get()
    res.status(201).json({ partner: mapPartner(snap, logoUrl) })
  } catch (error) {
    if (user?.uid) {
      await auth.deleteUser(user.uid).catch(() => {})
    }

    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'That email already has an account' })
      return
    }

    console.error('[partners] create failed', error)
    res.status(500).json({ error: 'Could not create partner' })
  }
}

async function updatePartner(req, res) {
  const partnerRef = db.collection('partners').doc(req.params.id)
  const snap = await partnerRef.get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Partner not found' })
    return
  }

  const companyName = String(req.body.companyName || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')
  const current = snap.data() || {}
  const ownerUid = current.ownerUid

  if (!companyName || !email) {
    res.status(400).json({ error: 'Company name and email are required' })
    return
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  if (!ownerUid) {
    res.status(400).json({ error: 'Partner is missing an owner account' })
    return
  }

  const auth = getAuth(firebaseApp)
  const authUpdates = { email, displayName: companyName }
  if (password) {
    authUpdates.password = password
  }

  try {
    await auth.updateUser(ownerUid, authUpdates)

    let logoPath = current.logoPath || ''
    let logoUrl = current.logoUrl || ''

    if (req.file) {
      if (logoPath) {
        await deletePartnerLogo(logoPath).catch(() => {})
      }
      const uploaded = await uploadPartnerLogo(partnerRef.id, req.file)
      logoPath = uploaded.logoPath
      logoUrl = uploaded.logoUrl
    }

    await partnerRef.update({
      companyName,
      email,
      logoPath,
      logoUrl,
    })

    await db.collection('users').doc(ownerUid).update({
      email,
      companyName,
      logoPath,
      logoUrl,
    })

    const staffSnap = await db.collection('users').where('partnerId', '==', partnerRef.id).get()
    const staffUpdates = staffSnap.docs.filter((doc) => doc.data()?.role === STAFF_ROLE)
    if (staffUpdates.length) {
      const batch = db.batch()
      staffUpdates.forEach((doc) => {
        batch.update(doc.ref, { companyName, logoPath, logoUrl })
      })
      await batch.commit()
    }

    const updated = await partnerRef.get()
    res.json({ partner: await withLogo(updated) })
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'That email already has an account' })
      return
    }

    console.error('[partners] update failed', error)
    res.status(500).json({ error: 'Could not update partner' })
  }
}

async function deletePartner(req, res) {
  const partnerRef = db.collection('partners').doc(req.params.id)
  const snap = await partnerRef.get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Partner not found' })
    return
  }

  const data = snap.data() || {}
  const ownerUid = data.ownerUid || ''
  const staffUids = Array.isArray(data.staffUids) ? data.staffUids.filter(Boolean) : []
  const auth = getAuth(firebaseApp)

  try {
    const relatedUids = [...new Set([...staffUids, ownerUid].filter(Boolean))]
    await Promise.all(relatedUids.map((uid) => auth.deleteUser(uid).catch(() => {})))

    const usersSnap = await db.collection('users').where('partnerId', '==', partnerRef.id).get()
    const batch = db.batch()
    usersSnap.docs.forEach((doc) => batch.delete(doc.ref))
    if (ownerUid) {
      batch.delete(db.collection('users').doc(ownerUid))
    }
    batch.delete(partnerRef)
    await batch.commit()

    await deletePartnerLogo(data.logoPath).catch(() => {})

    res.json({ ok: true })
  } catch (error) {
    console.error('[partners] delete failed', error)
    res.status(500).json({ error: 'Could not delete partner' })
  }
}

module.exports = {
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
}
