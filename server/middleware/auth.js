import { getAuth } from 'firebase-admin/auth'
import firebaseApp from '../firebaseAdmin.js'
import { db } from '../firestore.js'
import { ADMIN_ROLE, mapUserDoc, SUPERADMIN_ROLE } from '../models/user.js'

export async function requireAuth(req, res, next) {
  const header = req.headers.authorization || ''
  const token = header.startsWith('Bearer ') ? header.slice(7) : ''

  if (!token) {
    res.status(401).json({ error: 'Missing token' })
    return
  }

  try {
    const decoded = await getAuth(firebaseApp).verifyIdToken(token)
    const snap = await db.collection('users').doc(decoded.uid).get()
    req.user = decoded
    req.profile = mapUserDoc(decoded.uid, snap.exists ? snap.data() : {}, decoded.email)
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function requireAdmin(req, res, next) {
  if (req.profile?.role !== ADMIN_ROLE) {
    res.status(403).json({ error: 'Admin only' })
    return
  }

  next()
}

export function requireSuperAdmin(req, res, next) {
  if (req.profile?.role !== SUPERADMIN_ROLE) {
    res.status(403).json({ error: 'Superadmin only' })
    return
  }

  next()
}

