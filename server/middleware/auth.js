const { getAuth } = require('firebase-admin/auth')
const firebaseApp = require('../firebaseAdmin')
const { db } = require('../firestore')
const { ADMIN_ROLE, mapUserDoc, SUPERADMIN_ROLE } = require('../models/user')

async function requireAuth(req, res, next) {
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

function requireAdmin(req, res, next) {
  if (req.profile?.role !== ADMIN_ROLE) {
    res.status(403).json({ error: 'Admin only' })
    return
  }

  next()
}

function requireSuperAdmin(req, res, next) {
  if (req.profile?.role !== SUPERADMIN_ROLE) {
    res.status(403).json({ error: 'Superadmin only' })
    return
  }

  next()
}

module.exports = {
  requireAuth,
  requireAdmin,
  requireSuperAdmin,
}
