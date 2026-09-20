import { getDownloadURL, ref, uploadBytes } from 'firebase/storage'
import { storage } from '../firebase'

export function draftLineTotal(doc) {
  const totalPages = (doc.bwPages || 0) + (doc.colorPages || 0)
  const billedBw = doc.forceBlackAndWhite ? totalPages : doc.bwPages || 0
  const billedColor = doc.forceBlackAndWhite ? 0 : doc.colorPages || 0
  const copies = doc.copies || 1
  const priceBw = Number(doc.paperSize?.priceBw) || 0
  const priceColor = Number(doc.paperSize?.priceColor) || 0
  return billedBw * copies * priceBw + billedColor * copies * priceColor
}

export function draftColorMode(doc) {
  const totalPages = (doc.bwPages || 0) + (doc.colorPages || 0)
  const billedBw = doc.forceBlackAndWhite ? totalPages : doc.bwPages || 0
  const billedColor = doc.forceBlackAndWhite ? 0 : doc.colorPages || 0
  if (billedColor > 0 && billedBw > 0) return 'mixed'
  if (billedColor > 0) return 'color'
  return 'bw'
}

export function draftPageBreakdown(doc) {
  const totalPages = (doc.bwPages || 0) + (doc.colorPages || 0)
  const billedBw = doc.forceBlackAndWhite ? totalPages : doc.bwPages || 0
  const billedColor = doc.forceBlackAndWhite ? 0 : doc.colorPages || 0
  if (doc.forceBlackAndWhite && (doc.colorPages || 0) > 0) {
    return `${totalPages} B&W (color as B&W)`
  }
  if (billedColor > 0 && billedBw > 0) return `${billedBw} B&W · ${billedColor} color`
  if (billedColor > 0) return `${billedColor} color page${billedColor === 1 ? '' : 's'}`
  if (billedBw > 0) return `${billedBw} B&W page${billedBw === 1 ? '' : 's'}`
  return 'No pages'
}

export function buildPrintDraft({
  file,
  paperSize,
  copies,
  bwPages,
  colorPages,
  pageIsColor,
  forceBlackAndWhite,
}) {
  return {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    file,
    fileName: file?.name || 'document.pdf',
    paperSize,
    copies: Math.max(1, Math.min(50, Number(copies) || 1)),
    bwPages: Number(bwPages) || 0,
    colorPages: Number(colorPages) || 0,
    pageIsColor: Array.isArray(pageIsColor) ? pageIsColor : [],
    forceBlackAndWhite: Boolean(forceBlackAndWhite),
  }
}

function mimeForName(name = '') {
  const ext = String(name).toLowerCase().split('.').pop()
  switch (ext) {
    case 'pdf':
      return 'application/pdf'
    case 'png':
      return 'image/png'
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg'
    case 'doc':
      return 'application/msword'
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    default:
      return 'application/octet-stream'
  }
}

export async function uploadPrintFile({ partnerId, userId, file, fileName }) {
  const safeName = String(fileName || file?.name || 'document.pdf').replace(/[^\w.\- ]+/g, '_')
  const objectPath = `partners/${partnerId}/jobs/${userId}/${Date.now()}_${safeName}`
  const storageRef = ref(storage, objectPath)
  const contentType = file?.type || mimeForName(safeName)
  await uploadBytes(storageRef, file, { contentType })
  const fileUrl = await getDownloadURL(storageRef)
  return { fileUrl, filePath: objectPath }
}

export function draftToOrderPayload(doc, upload) {
  const totalPages = (doc.bwPages || 0) + (doc.colorPages || 0)
  const billedBw = doc.forceBlackAndWhite ? totalPages : doc.bwPages || 0
  const billedColor = doc.forceBlackAndWhite ? 0 : doc.colorPages || 0
  return {
    documentName: doc.fileName,
    fileUrl: upload.fileUrl,
    filePath: upload.filePath,
    paperSizeId: doc.paperSize?.id,
    copies: doc.copies,
    pages: totalPages,
    bwPages: billedBw,
    colorPages: billedColor,
    colorMode: draftColorMode(doc),
    forceBlackAndWhite: Boolean(doc.forceBlackAndWhite),
  }
}
