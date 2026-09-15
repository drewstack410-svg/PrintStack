const PAYMONGO_API = 'https://api.paymongo.com/v1'

const getSecretKey = () => {
  const key = process.env.PAYMONGO_SECRET_KEY?.trim()
  if (!key) {
    const err = new Error('PayMongo is not configured. Set PAYMONGO_SECRET_KEY in server/.env')
    err.status = 503
    throw err
  }
  return key
}

const paymongoRequest = async (path, { method = 'GET', body } = {}) => {
  const fetchFn = global.fetch
    ? (...args) => global.fetch(...args)
    : (...args) => import('node-fetch').then(({ default: f }) => f(...args))

  const res = await fetchFn(`${PAYMONGO_API}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${getSecretKey()}:`).toString('base64')}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const json = await res.json().catch(() => ({}))
  if (!res.ok) {
    const detail = json?.errors?.[0]?.detail || json?.errors?.[0]?.code || res.statusText
    const err = new Error(detail || 'PayMongo request failed')
    err.status = res.status >= 400 && res.status < 600 ? res.status : 502
    err.paymongo = json
    throw err
  }
  return json
}

const wrapAttributes = (attributes) => ({ data: { attributes } })

exports.createPaymentIntent = (attributes) =>
  paymongoRequest('/payment_intents', { method: 'POST', body: wrapAttributes(attributes) })

exports.createPaymentMethod = (attributes) =>
  paymongoRequest('/payment_methods', { method: 'POST', body: wrapAttributes(attributes) })

exports.attachPaymentIntent = (paymentIntentId, attributes) =>
  paymongoRequest(`/payment_intents/${paymentIntentId}/attach`, {
    method: 'POST',
    body: wrapAttributes(attributes),
  })

exports.getPaymentIntent = (paymentIntentId) =>
  paymongoRequest(`/payment_intents/${paymentIntentId}`)

exports.getPublicKey = () => process.env.PAYMONGO_PUBLIC_KEY?.trim() || ''
