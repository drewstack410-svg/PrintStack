import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import {
  ADMIN_ROLE,
  CUSTOMER_ROLE,
  PARTNER_ROLE,
  STAFF_ROLE,
  SUPERADMIN_ROLE,
} from '../users'

const PROTECTED_ROLES = new Set([
  SUPERADMIN_ROLE,
  ADMIN_ROLE,
  PARTNER_ROLE,
  STAFF_ROLE,
])

function splitDisplayName(displayName = '') {
  const parts = displayName
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (parts.length === 0) {
    return { firstName: '', lastName: '' }
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' '),
  }
}

/**
 * Creates or refreshes a Firestore user doc for customer sign-in/sign-up.
 * Never demotes protected roles (admin / superadmin / staff / partner).
 */
export async function ensureCustomerProfile(user, extras = {}) {
  if (!user?.uid) {
    return
  }

  const ref = doc(db, 'users', user.uid)
  const snap = await getDoc(ref)
  const fromDisplay = splitDisplayName(user.displayName || '')
  const firstName = (extras.firstName || fromDisplay.firstName || '').trim()
  const lastName = (extras.lastName || fromDisplay.lastName || '').trim()
  const photoUrl = user.photoURL || ''

  if (!snap.exists()) {
    await setDoc(ref, {
      uid: user.uid,
      email: user.email || '',
      firstName,
      middleName: '',
      lastName,
      photoUrl,
      role: CUSTOMER_ROLE,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    })
    return
  }

  const data = snap.data() || {}
  const currentRole = String(data.role || '').trim()
  const updates = {
    email: user.email || data.email || '',
    updatedAt: serverTimestamp(),
  }

  if (!currentRole || currentRole === 'user') {
    updates.role = CUSTOMER_ROLE
  }

  if (!String(data.firstName || '').trim() && firstName) {
    updates.firstName = firstName
  }
  if (!String(data.lastName || '').trim() && lastName) {
    updates.lastName = lastName
  }
  if (!String(data.photoUrl || '').trim() && photoUrl) {
    updates.photoUrl = photoUrl
  }

  if (PROTECTED_ROLES.has(currentRole)) {
    delete updates.role
  }

  await setDoc(ref, updates, { merge: true })
}
