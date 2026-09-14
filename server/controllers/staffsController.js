import { getAuth } from 'firebase-admin/auth'
import { FieldValue } from 'firebase-admin/firestore'
import firebaseApp from '../firebaseAdmin.js'
import { db } from '../firestore.js'
import { STAFF_ROLE } from '../models/user.js'
import { signedLogoUrl } from '../storage.js'

function mapStaff(doc) {
  const data = doc.data() || {}
  return {
    id: doc.id,
    uid: data.uid || doc.id,
    firstName: data.firstName || '',
    middleName: data.middleName || '',
    lastName: data.lastName || '',
    email: data.email || '',
    partnerId: data.partnerId || '',
    ownerUid: data.ownerUid || '',
    companyName: data.companyName || '',
    logoUrl: data.logoUrl || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
  }
}

async function partnerContext(req, res) {
  const partnerId = req.profile?.partnerId
  if (!partnerId) {
    res.status(400).json({ error: 'This admin is not linked to a partner' })
    return null
  }

  const partnerSnap = await db.collection('partners').doc(partnerId).get()
  if (!partnerSnap.exists) {
    res.status(400).json({ error: 'Partner record was not found' })
    return null
  }

  const partner = partnerSnap.data() || {}
  return {
    partnerId,
    partnerRef: partnerSnap.ref,
    companyName: partner.companyName || req.profile.companyName || '',
    ownerUid: partner.ownerUid || req.user.uid,
    logoPath: partner.logoPath || '',
    logoUrl: partner.logoUrl || '',
  }
}

async function loadOwnedStaff(req, res, id) {
  const context = await partnerContext(req, res)
  if (!context) {
    return null
  }

  const snap = await db.collection('users').doc(id).get()
  const data = snap.exists ? snap.data() : null
  if (!data || data.role !== STAFF_ROLE || data.partnerId !== context.partnerId) {
    res.status(404).json({ error: 'Staff not found' })
    return null
  }

  return { snap, data, context }
}

function linkStaffUids(batch, context, staffUid, action) {
  const value = action === 'remove' ? FieldValue.arrayRemove(staffUid) : FieldValue.arrayUnion(staffUid)
  batch.set(context.partnerRef, { staffUids: value }, { merge: true })
  if (context.ownerUid) {
    batch.set(db.collection('users').doc(context.ownerUid), { staffUids: value }, { merge: true })
  }
}

export async function listStaffs(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  const snap = await db.collection('users').where('partnerId', '==', context.partnerId).get()
  const logoUrl = context.logoPath ? await signedLogoUrl(context.logoPath) : context.logoUrl || ''
  const staffs = snap.docs
    .filter((doc) => doc.data()?.role === STAFF_ROLE)
    .map((doc) => {
      const staff = mapStaff(doc)
      return { ...staff, logoUrl: logoUrl || staff.logoUrl }
    })
    .sort((left, right) => String(right.createdAt || '').localeCompare(String(left.createdAt || '')))

  res.json({ staffs })
}

export async function createStaff(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  const firstName = String(req.body.firstName || '').trim()
  const middleName = String(req.body.middleName || '').trim()
  const lastName = String(req.body.lastName || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!firstName || !lastName || !email || !password) {
    res.status(400).json({ error: 'First name, last name, email, and password are required' })
    return
  }

  if (password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const auth = getAuth(firebaseApp)
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ')
  let user

  try {
    user = await auth.createUser({
      email,
      password,
      displayName,
    })

    const staffRef = db.collection('users').doc(user.uid)
    const batch = db.batch()
    batch.set(staffRef, {
      uid: user.uid,
      email,
      firstName,
      middleName,
      lastName,
      role: STAFF_ROLE,
      partnerId: context.partnerId,
      ownerUid: context.ownerUid,
      companyName: context.companyName,
      logoPath: context.logoPath,
      logoUrl: context.logoUrl,
      createdBy: req.user.uid,
      createdAt: FieldValue.serverTimestamp(),
    })
    linkStaffUids(batch, context, user.uid, 'add')
    await batch.commit()

    const snap = await staffRef.get()
    res.status(201).json({ staff: mapStaff(snap) })
  } catch (error) {
    if (user?.uid) {
      await auth.deleteUser(user.uid).catch(() => {})
      await db.collection('users').doc(user.uid).delete().catch(() => {})
    }

    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'That email already has an account' })
      return
    }

    console.error('[staffs] create failed', error)
    res.status(500).json({ error: 'Could not create staff' })
  }
}

export async function updateStaff(req, res) {
  const owned = await loadOwnedStaff(req, res, req.params.id)
  if (!owned) {
    return
  }

  const firstName = String(req.body.firstName || '').trim()
  const middleName = String(req.body.middleName || '').trim()
  const lastName = String(req.body.lastName || '').trim()
  const email = String(req.body.email || '').trim().toLowerCase()
  const password = String(req.body.password || '')

  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: 'First name, last name, and email are required' })
    return
  }

  if (password && password.length < 6) {
    res.status(400).json({ error: 'Password must be at least 6 characters' })
    return
  }

  const auth = getAuth(firebaseApp)
  const displayName = [firstName, middleName, lastName].filter(Boolean).join(' ')
  const authUpdates = { email, displayName }
  if (password) {
    authUpdates.password = password
  }

  try {
    await auth.updateUser(req.params.id, authUpdates)
    await db.collection('users').doc(req.params.id).update({
      firstName,
      middleName,
      lastName,
      email,
      uid: req.params.id,
      partnerId: owned.context.partnerId,
      ownerUid: owned.context.ownerUid,
    })

    const snap = await db.collection('users').doc(req.params.id).get()
    res.json({ staff: mapStaff(snap) })
  } catch (error) {
    if (error.code === 'auth/email-already-exists') {
      res.status(409).json({ error: 'That email already has an account' })
      return
    }

    console.error('[staffs] update failed', error)
    res.status(500).json({ error: 'Could not update staff' })
  }
}

export async function deleteStaff(req, res) {
  if (req.params.id === req.user.uid) {
    res.status(400).json({ error: 'You cannot delete your own account' })
    return
  }

  const owned = await loadOwnedStaff(req, res, req.params.id)
  if (!owned) {
    return
  }

  const auth = getAuth(firebaseApp)

  try {
    await auth.deleteUser(req.params.id)
    const batch = db.batch()
    batch.delete(db.collection('users').doc(req.params.id))
    linkStaffUids(batch, owned.context, req.params.id, 'remove')
    await batch.commit()
    res.json({ ok: true })
  } catch (error) {
    console.error('[staffs] delete failed', error)
    res.status(500).json({ error: 'Could not delete staff' })
  }
}
