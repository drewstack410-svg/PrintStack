import 'dart:io';
import 'dart:typed_data';

import 'package:pdfrx/pdfrx.dart';

/// Returns the PDF page count for a local file.
Future<int> countPdfPages(String filePath) async {
  final doc = await PdfDocument.openFile(filePath);
  try {
    return doc.pages.isEmpty ? 1 : doc.pages.length;
  } finally {
    await doc.dispose();
  }
}

/// Fallback page count from raw bytes when the native parser is unavailable.
int estimatePdfPagesFromBytes(Uint8List bytes) {
  final text = String.fromCharCodes(bytes);
  final matches = RegExp(r'/Type\s*/Page(?!\w)').allMatches(text).length;
  return matches > 0 ? matches : 1;
}

Future<int> countPdfPagesSafe(String filePath) async {
  try {
    final pages = await countPdfPages(filePath);
    return pages < 1 ? 1 : pages;
  } catch (_) {
    try {
      final bytes = await File(filePath).readAsBytes();
      return estimatePdfPagesFromBytes(bytes);
    } catch (_) {
      return 1;
    }
  }
}
