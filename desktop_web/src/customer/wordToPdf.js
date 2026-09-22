function extension(name = '') {
  const parts = String(name).toLowerCase().split('.')
  return parts.length > 1 ? parts.at(-1) : ''
}

export function isWordFile(file) {
  return extension(file?.name) === 'docx'
}

function pdfFileName(name = 'document.docx') {
  const base = String(name).replace(/\.docx$/i, '').trim() || 'document'
  return `${base}.pdf`
}

/**
 * Renders a DOCX into paginated HTML, then preserves those rendered pages in
 * a PDF. The resulting PDF is used for preview, page analysis, upload, and
 * printing so all stages operate on the same document.
 */
export async function convertWordToPdf(file) {
  if (!isWordFile(file)) {
    throw new Error('Only modern Word documents (.docx) can be converted.')
  }

  const [{ renderAsync }, { default: html2canvas }, { jsPDF }] = await Promise.all([
    import('docx-preview'),
    import('html2canvas'),
    import('jspdf'),
  ])

  const host = document.createElement('div')
  const styles = document.createElement('div')
  const pagesHost = document.createElement('div')
  host.setAttribute('aria-hidden', 'true')
  Object.assign(host.style, {
    position: 'fixed',
    left: '-100000px',
    top: '0',
    width: '1200px',
    background: '#ffffff',
    pointerEvents: 'none',
  })
  host.append(styles, pagesHost)
  document.body.appendChild(host)

  try {
    await renderAsync(await file.arrayBuffer(), pagesHost, styles, {
      breakPages: true,
      ignoreLastRenderedPageBreak: false,
      inWrapper: true,
      useBase64URL: true,
    })

    const pages = [...pagesHost.querySelectorAll('section.docx')]
    if (!pages.length) {
      throw new Error('The Word document did not contain any printable pages.')
    }

    let pdf = null
    for (const [index, page] of pages.entries()) {
      const pageBounds = page.getBoundingClientRect()
      const canvas = await html2canvas(page, {
        backgroundColor: '#ffffff',
        scale: 2,
        useCORS: true,
        logging: false,
      })
      // Keep the PDF's physical page size at the rendered CSS dimensions.
      // The canvas is intentionally 2x for sharpness, but using those bitmap
      // dimensions as the PDF format would make A4 appear twice as large.
      const width = Math.max(1, pageBounds.width)
      const height = Math.max(1, pageBounds.height)
      const orientation = width > height ? 'landscape' : 'portrait'

      if (!pdf) {
        pdf = new jsPDF({
          orientation,
          unit: 'px',
          format: [width, height],
          hotfixes: ['px_scaling'],
          compress: true,
        })
      } else {
        pdf.addPage([width, height], orientation)
      }

      pdf.addImage(canvas.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, width, height)

      // Let the browser release the previous page's large backing canvas.
      canvas.width = 1
      canvas.height = 1
      if (index % 2 === 1) {
        await new Promise((resolve) => setTimeout(resolve, 0))
      }
    }

    const blob = pdf.output('blob')
    return new File([blob], pdfFileName(file.name), {
      type: 'application/pdf',
      lastModified: Date.now(),
    })
  } finally {
    host.remove()
  }
}
