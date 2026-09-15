const crypto = require('crypto')

/**
 * Verify Paymongo-Signature header (t=...,te=...,li=...).
 * @see https://docs.paymongo.com/docs/developer-tools-webhook-setup-management
 */
const verifyPaymongoSignature = (rawBody, signatureHeader, webhookSecret) => {
  if (!rawBody || !signatureHeader || !webhookSecret) {
    return false
  }

  const parts = String(signatureHeader).split(',').reduce((acc, piece) => {
    const [key, value] = piece.split('=')
    if (key && value !== undefined) {
      acc[key.trim()] = value.trim()
    }
    return acc
  }, {})

  const timestamp = parts.t
  const testSig = parts.te
  const liveSig = parts.li

  if (!timestamp) return false

  const payload = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(String(rawBody), 'utf8')
  const signedPayload = `${timestamp}.${payload.toString('utf8')}`

  const expectedTest = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')
  const expectedLive = crypto.createHmac('sha256', webhookSecret).update(signedPayload).digest('hex')

  const compare = (expected, provided) => {
    if (!provided || !expected) return false
    try {
      const a = Buffer.from(expected, 'hex')
      const b = Buffer.from(provided, 'hex')
      if (a.length !== b.length) return false
      return crypto.timingSafeEqual(a, b)
    } catch {
      return false
    }
  }

  if (compare(expectedTest, testSig) || compare(expectedLive, liveSig)) {
    return true
  }

  return false
}

/** Extract payment intent id from PayMongo webhook event payload. */
const extractPaymentIntentIdFromEvent = (body) => {
  const attrs = body?.data?.attributes
  if (!attrs) return null

  const eventType = attrs.type
  const inner = attrs.data
  if (!inner) return null

  if (eventType === 'payment_intent.succeeded' && inner.type === 'payment_intent') {
    return inner.id || null
  }

  if (eventType === 'payment.paid' && inner.type === 'payment') {
    return inner.attributes?.payment_intent_id || null
  }

  return null
}

module.exports = {
  verifyPaymongoSignature,
  extractPaymentIntentIdFromEvent,
}
