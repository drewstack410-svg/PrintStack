const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')
const {
  createPaymentIntent,
  createPaymentMethod,
  attachPaymentIntent,
  getPaymentIntent,
  getPublicKey,
} = require('../utils/paymongo')
const {
  verifyPaymongoSignature,
  extractPaymentIntentIdFromEvent,
} = require('../utils/paymongoWebhook')
const { buildPaymentReturnUrl } = require('../utils/clientReturnUrl')
const { fulfillPrintOrderFromPaymentIntent } = require('../services/printPaymentFulfillment')
const {
  jobReferenceFields,
  mapPayment,
  paymentRef,
  writeStatusEvent,
} = require('../services/printJobCrossReferences')

function jobsRef(partnerId) {
  return db.collection('partners').doc(partnerId).collection('printJobs')
}

function formatPesoFromCentavos(centavos) {
  if (centavos == null || !Number.isFinite(Number(centavos))) return null
  return (Number(centavos) / 100).toFixed(2)
}

async function recordFailedPayment(paymentIntentId) {
  if (!paymentIntentId) return

  const recordRef = paymentRef(paymentIntentId)
  const paymentSnap = await recordRef.get()
  const payment = paymentSnap.data() || {}
  const partnerId = String(payment.partnerId || '')
  const printJobId = String(payment.printJobId || '')
  const batch = db.batch()

  batch.set(recordRef, {
    paymentStatus: 'failed',
    providerStatus: 'failed',
    updatedAt: FieldValue.serverTimestamp(),
  }, { merge: true })

  if (partnerId && printJobId) {
    const ref = jobsRef(partnerId).doc(printJobId)
    batch.update(ref, {
      paymentStatus: 'failed',
      rawStatus: 'Online payment failed — payment can be retried',
      updatedAt: FieldValue.serverTimestamp(),
    })
    writeStatusEvent(batch, {
      jobRef: ref,
      partnerId,
      printJobId,
      customerUid: String(payment.customerUid || ''),
      paymentIntentId,
      status: 'awaiting_payment',
      rawStatus: 'Online payment failed — payment can be retried',
      source: 'payment',
    })
  }

  await batch.commit()
}

async function verifyPaymentIntentForUser(paymentIntentId, userId) {
  const intentRes = await getPaymentIntent(paymentIntentId)
  const intent = intentRes?.data
  if (!intent?.id) {
    throw Object.assign(new Error('Payment intent not found'), { status: 404 })
  }

  const attrs = intent.attributes || {}
  if (attrs.status !== 'succeeded') {
    throw Object.assign(new Error(`Payment not completed (status: ${attrs.status})`), {
      status: 402,
    })
  }

  const meta = attrs.metadata || {}
  if (meta.userId && String(meta.userId) !== String(userId)) {
    throw Object.assign(new Error('Payment does not belong to this account'), { status: 403 })
  }

  return { intent, attrs, meta }
}

async function loadPayablePrintJob({ partnerId, printJobId, userId }) {
  const ref = jobsRef(partnerId).doc(printJobId)
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Print job not found'), { status: 404 })
  }

  const data = snap.data() || {}
  if (data.status === 'cancelled') {
    throw Object.assign(new Error('This reservation has been cancelled'), { status: 409 })
  }
  if (data.customerUid && String(data.customerUid) !== String(userId)) {
    throw Object.assign(new Error('You are not authorized to pay for this order'), {
      status: 403,
    })
  }

  if (data.paymentStatus === 'paid') {
    throw Object.assign(new Error('This order is already paid'), { status: 409 })
  }

  const totalPrice = Number(data.totalPrice) || 0
  const amountCentavos = Math.round(totalPrice * 100)
  if (!Number.isFinite(amountCentavos) || amountCentavos < 100) {
    throw Object.assign(new Error('Order total must be at least ₱1.00'), { status: 400 })
  }

  return { ref, data, amountCentavos, totalPrice }
}

exports.getPaymongoConfig = (_req, res) => {
  const publicKey = getPublicKey()
  if (!publicKey) {
    return res.status(503).json({ error: 'PayMongo is not configured' })
  }
  return res.json({
    publicKey,
    currency: 'PHP',
    methods: ['gcash', 'paymaya'],
  })
}

exports.listMyPrintOrderPayments = async (req, res) => {
  const userId = req.user?.uid
  if (!userId) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  try {
    let snap
    try {
      snap = await db
        .collection('payments')
        .where('customerUid', '==', userId)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get()
    } catch (error) {
      console.warn('[payments] list fallback', error.message)
      snap = await db
        .collection('payments')
        .where('customerUid', '==', userId)
        .limit(50)
        .get()
    }

    const payments = snap.docs
      .map(mapPayment)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
    return res.json({ payments })
  } catch (err) {
    console.error('Failed to list print order payments', err)
    return res.status(500).json({ error: 'Failed to load payments' })
  }
}

/** Create a PayMongo PaymentIntent for an awaiting_payment print job. */
exports.createPrintOrderIntent = async (req, res) => {
  try {
    const userId = req.user?.uid
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const partnerId = String(req.body?.partnerId || '').trim()
    const printJobId = String(req.body?.printJobId || '').trim()
    if (!partnerId || !printJobId) {
      return res.status(400).json({ error: 'partnerId and printJobId are required' })
    }

    const { ref, data, amountCentavos, totalPrice } = await loadPayablePrintJob({
      partnerId,
      printJobId,
      userId,
    })

    const orderLabel = data.orderNumber
      ? `Print order #${data.orderNumber}`
      : `Print order ${printJobId}`

    const intentRes = await createPaymentIntent({
      amount: amountCentavos,
      currency: 'PHP',
      payment_method_allowed: ['gcash', 'paymaya'],
      description: orderLabel,
      statement_descriptor: 'PrintStack',
      metadata: {
        checkoutType: 'print_order',
        userId: String(userId),
        partnerId: String(partnerId),
        printJobId: String(printJobId),
        orderNumber: String(data.orderNumber || ''),
      },
    })

    const intent = intentRes.data
    const references = jobReferenceFields({
      partnerId,
      printJobId,
      customerUid: userId,
    })
    const partnerSnap = await references.partnerRef.get()
    const partnerName = String(partnerSnap.data()?.companyName || '')
    const recordRef = paymentRef(intent.id)

    const batch = db.batch()
    batch.update(ref, {
      paymentIntentId: intent.id,
      paymentPath: recordRef.path,
      paymentRef: recordRef,
      paymentStatus: 'pending',
      rawStatus: 'Awaiting online payment',
      updatedAt: FieldValue.serverTimestamp(),
    })
    batch.set(recordRef, {
      ...references,
      paymentIntentId: intent.id,
      paymentPath: recordRef.path,
      paymentRef: recordRef,
      checkoutType: 'print_order',
      orderNumber: String(data.orderNumber || ''),
      partnerName,
      amount: totalPrice,
      amountCentavos,
      currency: 'PHP',
      paymentStatus: 'pending',
      providerStatus: intent.attributes?.status || 'awaiting_payment_method',
      paymentMethodType: '',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    })
    await batch.commit()

    return res.json({
      paymentIntentId: intent.id,
      clientKey: intent.attributes.client_key,
      amount: amountCentavos,
      amountDisplay: totalPrice.toFixed(2),
      currency: 'PHP',
      partnerId,
      printJobId,
      orderNumber: data.orderNumber || null,
    })
  } catch (err) {
    console.error('Failed to create print order payment intent', err)
    return res.status(err.status || 500).json({
      error: err.message || 'Failed to create payment',
    })
  }
}

/** Attach GCash/Maya and pay (may return redirectUrl). */
exports.payPrintOrder = async (req, res) => {
  try {
    const userId = req.user?.uid
    const userEmail = req.profile?.email || req.user?.email || ''
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const {
      paymentIntentId,
      clientKey,
      paymentMethodType,
      billing,
      returnPath,
    } = req.body || {}

    if (!paymentIntentId || !clientKey) {
      return res.status(400).json({ error: 'paymentIntentId and clientKey are required' })
    }

    const type = String(paymentMethodType || 'gcash').toLowerCase()
    const allowed = ['gcash', 'paymaya']
    if (!allowed.includes(type)) {
      return res.status(400).json({ error: 'Unsupported payment method' })
    }

    const billName = (
      billing?.name ||
      [req.profile?.firstName, req.profile?.lastName].filter(Boolean).join(' ') ||
      'Customer'
    ).trim()
    const billEmail = (billing?.email || userEmail || '').trim()
    const billPhone = (billing?.phone || '09171234567').trim()

    if (!billEmail) {
      return res.status(400).json({ error: 'Billing email is required' })
    }

    const pmRes = await createPaymentMethod({
      type,
      billing: {
        name: billName,
        email: billEmail,
        phone: billPhone,
      },
    })

    const paymentMethodId = pmRes?.data?.id
    if (!paymentMethodId) {
      return res.status(502).json({ error: 'Failed to create payment method' })
    }

    const returnUrl = buildPaymentReturnUrl(
      returnPath || '/payment/confirmation',
      paymentIntentId,
    )

    const attachRes = await attachPaymentIntent(paymentIntentId, {
      payment_method: paymentMethodId,
      client_key: clientKey,
      return_url: returnUrl,
    })

    const attached = attachRes?.data
    const status = attached?.attributes?.status
    const nextAction = attached?.attributes?.next_action
    await paymentRef(paymentIntentId).set({
      paymentMethodType: type,
      providerStatus: status || '',
      paymentStatus: status === 'succeeded' ? 'paid' : 'pending',
      updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true })

    if (status === 'awaiting_next_action' && nextAction?.redirect?.url) {
      return res.json({
        status,
        redirectUrl: nextAction.redirect.url,
        paymentIntentId,
      })
    }

    if (status !== 'succeeded') {
      await recordFailedPayment(paymentIntentId)
      const errMsg =
        attached?.attributes?.last_payment_error?.message ||
        attached?.attributes?.last_payment_error?.detail ||
        'Payment could not be completed'
      return res.status(402).json({ error: errMsg, status })
    }

    await verifyPaymentIntentForUser(paymentIntentId, userId)
    const { record, created } = await fulfillPrintOrderFromPaymentIntent(paymentIntentId)

    return res.status(created ? 201 : 200).json({
      status: 'succeeded',
      paymentIntentId,
      printJob: record,
      message: 'Payment successful. Order queued for printing.',
    })
  } catch (err) {
    console.error('Pay print order failed', err)
    return res.status(err.status || 500).json({
      error: err.message || 'Payment failed',
    })
  }
}

/** After e-wallet redirect — finalize if payment succeeded. */
exports.finalizePrintOrderPayment = async (req, res) => {
  try {
    const userId = req.user?.uid
    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' })
    }

    const paymentIntentId = req.query.paymentIntentId || req.body?.paymentIntentId
    if (!paymentIntentId) {
      return res.status(400).json({ error: 'paymentIntentId is required' })
    }

    await verifyPaymentIntentForUser(paymentIntentId, userId)
    const { record, created } = await fulfillPrintOrderFromPaymentIntent(paymentIntentId)

    return res.status(created ? 201 : 200).json({
      paymentIntentId,
      amountDisplay: null,
      printJob: record,
      message: created ? 'Payment confirmed. Order queued.' : 'Order already paid.',
    })
  } catch (err) {
    console.error('Finalize print order payment failed', err)
    return res.status(err.status || 500).json({
      error: err.message || 'Failed to finalize payment',
    })
  }
}

/**
 * PayMongo webhook — must receive raw JSON body (see server.js route).
 */
exports.handlePaymongoWebhook = async (req, res) => {
  const webhookSecret = process.env.PAYMONGO_WEBHOOK_SECRET?.trim()
  if (!webhookSecret) {
    console.error('PAYMONGO_WEBHOOK_SECRET is not configured')
    return res.status(503).json({ error: 'Webhook not configured' })
  }

  const signatureHeader = req.headers['paymongo-signature'] || req.headers['Paymongo-Signature']
  const rawBody = req.body

  if (!verifyPaymongoSignature(rawBody, signatureHeader, webhookSecret)) {
    console.warn('PayMongo webhook signature verification failed')
    return res.status(401).json({ error: 'Invalid signature' })
  }

  let payload
  try {
    payload = JSON.parse(rawBody.toString('utf8'))
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' })
  }

  const eventType = payload?.data?.attributes?.type
  const eventId = payload?.data?.id

  res.status(200).json({
    received: true,
    eventId: eventId || null,
    type: eventType || null,
  })

  setImmediate(async () => {
    try {
      if (eventType === 'payment.failed') {
        const paymentIntentId = extractPaymentIntentIdFromEvent(payload)
        await recordFailedPayment(paymentIntentId)
        console.warn('PayMongo payment.failed', { eventId, paymentIntentId })
        return
      }

      if (eventType === 'payment.paid' || eventType === 'payment_intent.succeeded') {
        const paymentIntentId = extractPaymentIntentIdFromEvent(payload)
        if (!paymentIntentId) {
          console.warn('PayMongo webhook missing payment_intent_id', { eventId, eventType })
          return
        }

        let intentMeta = {}
        try {
          const intentRes = await getPaymentIntent(paymentIntentId)
          intentMeta = intentRes?.data?.attributes?.metadata || {}
        } catch (lookupErr) {
          console.warn('PayMongo webhook intent lookup failed', {
            eventId,
            paymentIntentId,
            message: lookupErr.message,
          })
        }

        if (intentMeta.checkoutType === 'print_order') {
          const result = await fulfillPrintOrderFromPaymentIntent(paymentIntentId)
          console.info('PayMongo webhook fulfilled print order', {
            eventId,
            eventType,
            paymentIntentId,
            created: result.created,
          })
        }
      }
    } catch (err) {
      console.error('PayMongo webhook processing error', {
        eventId,
        eventType,
        message: err.message,
      })
    }
  })
}

exports.formatPesoFromCentavos = formatPesoFromCentavos
