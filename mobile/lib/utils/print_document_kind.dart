enum PrintDocumentKind {
  pdf,
  officeInline,
  officeNative,
  image,
  other,
}

const _inlineOfficeExtensions = {'docx', 'xlsx'};
const _nativeOfficeExtensions = {'doc', 'xls'};

PrintDocumentKind printDocumentKindForPath(String path) {
  final ext = _extension(path);
  if (ext == 'pdf') {
    return PrintDocumentKind.pdf;
  }
  if (_inlineOfficeExtensions.contains(ext)) {
    return PrintDocumentKind.officeInline;
  }
  if (_nativeOfficeExtensions.contains(ext)) {
    return PrintDocumentKind.officeNative;
  }
  if (ext == 'png' || ext == 'jpg' || ext == 'jpeg') {
    return PrintDocumentKind.image;
  }
  return PrintDocumentKind.other;
}

bool isPrintableDocumentPath(String path) {
  return printDocumentKindForPath(path) != PrintDocumentKind.other;
}

String? mimeTypeForPrintFileName(String fileName) {
  switch (_extension(fileName)) {
    case 'pdf':
      return 'application/pdf';
    case 'png':
      return 'image/png';
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'doc':
      return 'application/msword';
    case 'docx':
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    case 'xls':
      return 'application/vnd.ms-excel';
    case 'xlsx':
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    default:
      return null;
  }
}

String _extension(String path) {
  final normalized = path.replaceAll('\\', '/');
  final dot = normalized.lastIndexOf('.');
  if (dot == -1 || dot == normalized.length - 1) {
    return '';
  }
  return normalized.substring(dot + 1).toLowerCase();
}
