const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')
const { getPaymentIntent } = require('../utils/paymongo')
const {
  jobReferenceFields,
  paymentRef,
  writeStatusEvent,
} = require('./printJobCrossReferences')

function jobsRef(partnerId) {
  return db.collection('partners').doc(partnerId).collection('printJobs')
}

/**
 * Mark a print job paid + queued after PayMongo succeeds (finalize or webhook).
 */
async function fulfillPrintOrderFromPaymentIntent(paymentIntentId) {
  if (!paymentIntentId) {
    throw Object.assign(new Error('paymentIntentId is required'), { status: 400 })
  }

  const intentRes = await getPaymentIntent(paymentIntentId)
  const intent = intentRes?.data
  const attrs = intent?.attributes || {}
  const meta = attrs.metadata || {}

  if (attrs.status !== 'succeeded') {
    throw Object.assign(new Error(`Payment not completed (status: ${attrs.status})`), {
      status: 402,
    })
  }

  if (meta.checkoutType && meta.checkoutType !== 'print_order') {
    throw Object.assign(new Error('Payment is not a print order'), { status: 400 })
  }

  const partnerId = String(meta.partnerId || '').trim()
  const printJobId = String(meta.printJobId || '').trim()
  if (!partnerId || !printJobId) {
    throw Object.assign(new Error('Payment metadata is missing partner/print job'), {
      status: 400,
    })
  }

  const ref = jobsRef(partnerId).doc(printJobId)
  const recordRef = paymentRef(paymentIntentId)

  return db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref)
    if (!snap.exists) {
      throw Object.assign(new Error('Print job not found'), { status: 404 })
    }

    const data = snap.data() || {}
    if (data.status === 'cancelled') {
      transaction.set(recordRef, {
        paymentStatus: 'paid',
        providerStatus: attrs.status,
        refundStatus: 'manual_review',
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true })
      transaction.update(ref, {
        paymentStatus: 'paid',
        refundStatus: 'manual_review',
        paidAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      })
      return {
        created: false,
        record: {
          partnerId,
          printJobId,
          orderNumber: data.orderNumber || null,
          paymentIntentId,
          paymentStatus: 'paid',
          status: 'cancelled',
        },
      }
    }

    const alreadyPaid =
      data.paymentStatus === 'paid' ||
      (data.paymentIntentId &&
        data.paymentIntentId === paymentIntentId &&
        data.status === 'queued')

    const record = {
      partnerId,
      printJobId,
      orderNumber: data.orderNumber || null,
      paymentIntentId,
      paymentStatus: 'paid',
      status: alreadyPaid ? data.status || 'queued' : 'queued',
    }

    if (alreadyPaid) {
      return { created: false, record }
    }

    const customerUid = String(data.customerUid || meta.userId || '')
    const references = jobReferenceFields({
      partnerId,
      printJobId,
      customerUid,
    })
    const paidAt = FieldValue.serverTimestamp()
    const isReservation = data.isReservation === true
    const rawStatus = isReservation
      ? 'Reservation paid — queued for the shop'
      : 'Payment received — waiting for partner desktop'

    transaction.update(ref, {
      ...references,
      status: 'queued',
      rawStatus,
      paymentStatus: 'paid',
      reservationStatus: isReservation ? 'confirmed' : '',
      paymentIntentId: String(paymentIntentId),
      paymentPath: recordRef.path,
      paymentRef: recordRef,
      paidAt,
      updatedAt: paidAt,
    })
    transaction.set(recordRef, {
      ...references,
      paymentIntentId: String(paymentIntentId),
      paymentPath: recordRef.path,
      paymentRef: recordRef,
      checkoutType: 'print_order',
      orderNumber: String(data.orderNumber || meta.orderNumber || ''),
      amount: Number(attrs.amount || 0) / 100,
      amountCentavos: Number(attrs.amount || 0),
      currency: attrs.currency || 'PHP',
      paymentStatus: 'paid',
      providerStatus: attrs.status,
      paidAt,
      updatedAt: paidAt,
    }, { merge: true })
    writeStatusEvent(transaction, {
      jobRef: ref,
      partnerId,
      printJobId,
      customerUid,
      paymentIntentId,
      status: 'queued',
      rawStatus,
      source: 'payment',
    })

    return { created: true, record }
  })
}

module.exports = {
  fulfillPrintOrderFromPaymentIntent,
}
