const { randomUUID } = require('node:crypto')
const path = require('node:path')
const { getStorage } = require('firebase-admin/storage')
const firebaseApp = require('./firebaseAdmin')

function storageBucket() {
  return getStorage(firebaseApp).bucket()
}

async function uploadPartnerLogo(partnerId, file) {
  const ext = path.extname(file.originalname || '').toLowerCase() || '.png'
  const objectPath = `partners/${partnerId}/logo${ext}`
  const token = randomUUID()
  const object = storageBucket().file(objectPath)

  await object.save(file.buffer, {
    resumable: false,
    metadata: {
      contentType: file.mimetype || 'image/png',
      metadata: {
        firebaseStorageDownloadTokens: token,
      },
    },
  })

  const logoUrl = `https://firebasestorage.googleapis.com/v0/b/${storageBucket().name}/o/${encodeURIComponent(objectPath)}?alt=media&token=${token}`
  return { logoPath: objectPath, logoUrl }
}

async function signedLogoUrl(logoPath) {
  if (!logoPath) {
    return ''
  }

  const [url] = await storageBucket()
    .file(logoPath)
    .getSignedUrl({
      action: 'read',
      expires: Date.now() + 1000 * 60 * 60 * 24,
    })

  return url
}

async function deletePartnerLogo(logoPath) {
  if (!logoPath) {
    return
  }

  await storageBucket().file(logoPath).delete({ ignoreNotFound: true })
}

module.exports = {
  storageBucket,
  uploadPartnerLogo,
  signedLogoUrl,
  deletePartnerLogo,
}
