import { db } from '../firestore.js'
import { DEFAULT_PAPER_SIZES, mapPaperSize, normalizePaperSizes } from '../lib/paperSizes.js'

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

  return {
    partnerId,
    partnerRef: partnerSnap.ref,
    partner: partnerSnap.data() || {},
  }
}

export async function listPaperSizes(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  let paperSizes = normalizePaperSizes(context.partner.paperSizes)
  if (!Array.isArray(context.partner.paperSizes) || context.partner.paperSizes.length === 0) {
    await context.partnerRef.set({ paperSizes }, { merge: true })
  }

  res.json({ paperSizes })
}

export async function createPaperSize(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  const paperSizes = normalizePaperSizes(context.partner.paperSizes)
  const next = mapPaperSize(
    {
      ...req.body,
      id: `size-${Date.now()}`,
    },
    `size-${Date.now()}`,
  )

  if (!next.name) {
    res.status(400).json({ error: 'Paper size name is required' })
    return
  }

  if (next.width <= 0 || next.height <= 0) {
    res.status(400).json({ error: 'Width and height must be greater than 0' })
    return
  }

  if (next.pricePerPiece < 0) {
    res.status(400).json({ error: 'Price per piece cannot be negative' })
    return
  }

  const updated = [...paperSizes, next]
  await context.partnerRef.set({ paperSizes: updated }, { merge: true })
  res.status(201).json({ paperSize: next, paperSizes: updated })
}

export async function updatePaperSize(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  const paperSizes = normalizePaperSizes(context.partner.paperSizes)
  const index = paperSizes.findIndex((item) => item.id === req.params.id)
  if (index === -1) {
    res.status(404).json({ error: 'Paper size not found' })
    return
  }

  const next = mapPaperSize({ ...paperSizes[index], ...req.body, id: paperSizes[index].id })
  if (!next.name) {
    res.status(400).json({ error: 'Paper size name is required' })
    return
  }

  if (next.width <= 0 || next.height <= 0) {
    res.status(400).json({ error: 'Width and height must be greater than 0' })
    return
  }

  if (next.pricePerPiece < 0) {
    res.status(400).json({ error: 'Price per piece cannot be negative' })
    return
  }

  const updated = paperSizes.map((item, itemIndex) => (itemIndex === index ? next : item))
  await context.partnerRef.set({ paperSizes: updated }, { merge: true })
  res.json({ paperSize: next, paperSizes: updated })
}

export async function deletePaperSize(req, res) {
  const context = await partnerContext(req, res)
  if (!context) {
    return
  }

  const paperSizes = normalizePaperSizes(context.partner.paperSizes)
  const updated = paperSizes.filter((item) => item.id !== req.params.id)
  if (updated.length === paperSizes.length) {
    res.status(404).json({ error: 'Paper size not found' })
    return
  }

  await context.partnerRef.set({ paperSizes: updated }, { merge: true })
  res.json({ ok: true, paperSizes: updated })
}

export { DEFAULT_PAPER_SIZES }
