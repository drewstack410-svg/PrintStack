const { FieldValue } = require('firebase-admin/firestore')
const { db } = require('../firestore')

function paymentRef(paymentIntentId) {
  return db.collection('payments').doc(String(paymentIntentId))
}

function jobReferenceFields({ partnerId, printJobId, customerUid = '' }) {
  const partnerRef = db.collection('partners').doc(partnerId)
  const printJobRef = partnerRef.collection('printJobs').doc(printJobId)
  const customerRef = customerUid
    ? db.collection('users').doc(customerUid)
    : null

  return {
    partnerId,
    printJobId,
    partnerPath: partnerRef.path,
    printJobPath: printJobRef.path,
    customerUid,
    customerPath: customerRef?.path || '',
    partnerRef,
    printJobRef,
    customerRef,
  }
}

function writeStatusEvent(writer, {
  jobRef,
  partnerId,
  printJobId,
  customerUid = '',
  paymentIntentId = '',
  status,
  rawStatus = '',
  source = 'server',
}) {
  const eventRef = jobRef.collection('statusHistory').doc()
  writer.set(eventRef, {
    ...jobReferenceFields({ partnerId, printJobId, customerUid }),
    paymentIntentId,
    paymentPath: paymentIntentId ? paymentRef(paymentIntentId).path : '',
    paymentRef: paymentIntentId ? paymentRef(paymentIntentId) : null,
    status,
    rawStatus,
    source,
    createdAt: FieldValue.serverTimestamp(),
  })
  return eventRef
}

function mapPayment(doc) {
  const data = doc.data() || {}
  return {
    id: doc.id,
    paymentIntentId: data.paymentIntentId || doc.id,
    paymentStatus: data.paymentStatus || 'pending',
    providerStatus: data.providerStatus || '',
    paymentMethodType: data.paymentMethodType || '',
    amount: Number(data.amount) || 0,
    currency: data.currency || 'PHP',
    partnerId: data.partnerId || '',
    printJobId: data.printJobId || '',
    orderNumber: data.orderNumber || '',
    partnerName: data.partnerName || '',
    printJobPath: data.printJobPath || '',
    createdAt: data.createdAt?.toDate?.()?.toISOString?.() || null,
    updatedAt: data.updatedAt?.toDate?.()?.toISOString?.() || null,
    paidAt: data.paidAt?.toDate?.()?.toISOString?.() || null,
  }
}

module.exports = {
  jobReferenceFields,
  mapPayment,
  paymentRef,
  writeStatusEvent,
}
