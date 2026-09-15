/**
 * Base URL for PayMongo return_url redirects (origin only).
 * Prefers APP_URL, then CLIENT_URL / CLIENT_ORIGIN (PrintStack / DrewStack naming).
 */
function clientReturnBase() {
  const raw =
    process.env.APP_URL?.trim() ||
    process.env.CLIENT_URL?.trim() ||
    (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',')[0].trim()

  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
    return new URL(withProtocol).origin
  } catch {
    return String(raw)
      .replace(/\/$/, '')
      .replace(/\/loading$/i, '')
  }
}

function appendQueryParam(path, key, value) {
  const separator = path.includes('?') ? '&' : '?'
  return `${path}${separator}${encodeURIComponent(key)}=${encodeURIComponent(value)}`
}

function buildPaymentReturnUrl(returnPath, paymentIntentId) {
  const path = returnPath || '/payment/confirmation'
  return `${clientReturnBase()}${appendQueryParam(path, 'payment_intent_id', paymentIntentId)}`
}

module.exports = {
  clientReturnBase,
  appendQueryParam,
  buildPaymentReturnUrl,
}
