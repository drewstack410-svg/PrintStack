const { existsSync, readFileSync } = require('node:fs')
const { resolve } = require('node:path')
const { cert, getApp, getApps, initializeApp } = require('firebase-admin/app')

function normalizePrivateKey(value) {
  if (typeof value !== 'string') {
    return value
  }
  let key = value.trim()
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1)
  }
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key
}

function loadServiceAccountFromVars() {
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim()
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL?.trim()
  const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY || '')

  if (!projectId || !clientEmail || !privateKey) {
    return null
  }

  return {
    type: process.env.FIREBASE_TYPE?.trim() || 'service_account',
    project_id: projectId,
    private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID?.trim() || undefined,
    private_key: privateKey,
    client_email: clientEmail,
    client_id: process.env.FIREBASE_CLIENT_ID?.trim() || undefined,
    auth_uri:
      process.env.FIREBASE_AUTH_URI?.trim() ||
      'https://accounts.google.com/o/oauth2/auth',
    token_uri:
      process.env.FIREBASE_TOKEN_URI?.trim() ||
      'https://oauth2.googleapis.com/token',
    auth_provider_x509_cert_url:
      process.env.FIREBASE_AUTH_PROVIDER_X509_CERT_URL?.trim() ||
      'https://www.googleapis.com/oauth2/v1/certs',
    client_x509_cert_url: process.env.FIREBASE_CLIENT_X509_CERT_URL?.trim() || undefined,
    universe_domain: process.env.FIREBASE_UNIVERSE_DOMAIN?.trim() || 'googleapis.com',
  }
}

function loadServiceAccountFromJson() {
  const fromEnv = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim()
  if (!fromEnv) {
    return null
  }
  const parsed = JSON.parse(fromEnv)
  parsed.private_key = normalizePrivateKey(parsed.private_key)
  return parsed
}

function loadServiceAccountFromFile() {
  const keyPath = resolve(__dirname, 'serviceAccountKey.json')
  if (!existsSync(keyPath)) {
    return null
  }
  return JSON.parse(readFileSync(keyPath, 'utf8'))
}

function loadServiceAccount() {
  const serviceAccount =
    loadServiceAccountFromVars() ||
    loadServiceAccountFromJson() ||
    loadServiceAccountFromFile()

  if (!serviceAccount) {
    throw new Error(
      'Firebase Admin credentials missing. Set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, and FIREBASE_PRIVATE_KEY (or add serviceAccountKey.json).',
    )
  }

  return serviceAccount
}

const serviceAccount = loadServiceAccount()

let firebaseApp

try {
  firebaseApp =
    getApps().length > 0
      ? getApp()
      : initializeApp({
          credential: cert(serviceAccount),
          projectId: serviceAccount.project_id,
          storageBucket:
            process.env.STORAGE_BUCKET || `${serviceAccount.project_id}.firebasestorage.app`,
        })

  console.log(
    `[firebase-admin] ready project=${serviceAccount.project_id} account=${serviceAccount.client_email} app=${firebaseApp.name}`,
  )
} catch (error) {
  console.error('[firebase-admin] failed to initialize', error)
  throw error
}

module.exports = firebaseApp
