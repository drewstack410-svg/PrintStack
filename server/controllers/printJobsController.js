import { FieldValue } from 'firebase-admin/firestore'
import { db } from '../firestore.js'

const STATUSES = new Set(['sending', 'queued', 'printing', 'printed', 'failed'])

function jobsRef(partnerId) {
  return db.collection('partners').doc(partnerId).collection('printJobs')
}

function mapJob(doc) {
  const data = doc.data() || {}
  return {
    id: doc.id,
    documentName: data.documentName || '',
    printerName: data.printerName || '',
    deviceName: data.deviceName || '',
    status: data.status || 'queued',
    rawStatus: data.rawStatus || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
  }
}

async function partnerIdFrom(req, res) {
  const partnerId = req.profile?.partnerId
  if (!partnerId) {
    res.status(400).json({ error: 'This admin is not linked to a partner' })
    return ''
  }
  return partnerId
}

export async function listPrintJobs(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  try {
    const snap = await jobsRef(partnerId).orderBy('createdAt', 'desc').limit(12).get()
    res.json({ printJobs: snap.docs.map(mapJob) })
  } catch (error) {
    console.warn('[print-jobs] list fallback', error.message)
    const snap = await jobsRef(partnerId).limit(12).get()
    const printJobs = snap.docs
      .map(mapJob)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    res.json({ printJobs })
  }
}

export async function createPrintJob(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  const documentName = String(req.body.documentName || '').trim()
  const printerName = String(req.body.printerName || '').trim()
  const deviceName = String(req.body.deviceName || '').trim()
  if (!documentName || !printerName) {
    res.status(400).json({ error: 'Document name and printer are required' })
    return
  }

  const ref = jobsRef(partnerId).doc()
  const job = {
    documentName,
    printerName,
    deviceName,
    status: 'sending',
    rawStatus: '',
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  }
  await ref.set(job)
  const snap = await ref.get()
  res.status(201).json({ printJob: mapJob(snap) })
}

export async function updatePrintJob(req, res) {
  const partnerId = await partnerIdFrom(req, res)
  if (!partnerId) {
    return
  }

  const ref = jobsRef(partnerId).doc(req.params.id)
  const snap = await ref.get()
  if (!snap.exists) {
    res.status(404).json({ error: 'Print job not found' })
    return
  }

  const status = String(req.body.status || '').trim()
  if (!STATUSES.has(status)) {
    res.status(400).json({ error: 'Invalid print status' })
    return
  }

  await ref.update({
    status,
    rawStatus: String(req.body.rawStatus || ''),
    updatedAt: FieldValue.serverTimestamp(),
  })

  const updated = await ref.get()
  res.json({ printJob: mapJob(updated) })
}
