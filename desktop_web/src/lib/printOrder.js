export function orderDocuments(job) {
  if (Array.isArray(job?.documents) && job.documents.length > 0) {
    return job.documents
  }
  if (job?.fileUrl || job?.documentName) {
    return [
      {
        id: 'doc-1',
        documentName: job.documentName,
        fileUrl: job.fileUrl,
        filePath: job.filePath,
        paperSizeId: job.paperSizeId,
        paperSizeName: job.paperSizeName,
        copies: job.copies,
        pages: job.pages,
        bwPages: job.bwPages,
        colorPages: job.colorPages,
        colorMode: job.colorMode,
        priceBw: job.priceBw,
        priceColor: job.priceColor,
        pricePerPiece: job.pricePerPiece,
        totalPrice: job.totalPrice,
        localPath: job.localPath,
        status: job.status,
      },
    ]
  }
  return []
}
