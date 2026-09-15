const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')
const { getPaymentIntent } = require('../utils/paymongo')

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
  const snap = await ref.get()
  if (!snap.exists) {
    throw Object.assign(new Error('Print job not found'), { status: 404 })
  }

  const data = snap.data() || {}
  const alreadyPaid =
    data.paymentStatus === 'paid' ||
    (data.paymentIntentId && data.paymentIntentId === paymentIntentId && data.status === 'queued')

  if (alreadyPaid) {
    return {
      created: false,
      record: {
        partnerId,
        printJobId,
        orderNumber: data.orderNumber || null,
        paymentIntentId,
        paymentStatus: 'paid',
        status: data.status || 'queued',
      },
    }
  }

  await ref.update({
    status: 'queued',
    rawStatus: 'Payment received — waiting for partner desktop',
    paymentStatus: 'paid',
    paymentIntentId: String(paymentIntentId),
    paidAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  })

  return {
    created: true,
    record: {
      partnerId,
      printJobId,
      orderNumber: data.orderNumber || null,
      paymentIntentId,
      paymentStatus: 'paid',
      status: 'queued',
    },
  }
}

module.exports = {
  fulfillPrintOrderFromPaymentIntent,
}
