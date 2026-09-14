import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:pdfrx/pdfrx.dart';

class PdfDocumentInfo {
  const PdfDocumentInfo({
    required this.pages,
    required this.isColor,
  });

  final int pages;
  final bool isColor;
}

/// Returns page count and whether the PDF appears to contain color.
Future<PdfDocumentInfo> analyzePdf(String filePath) async {
  final doc = await PdfDocument.openFile(filePath);
  try {
    final pages = doc.pages.isEmpty ? 1 : doc.pages.length;
    var isColor = false;

    // Sample up to the first 3 pages for speed.
    final sampleCount = math.min(pages, 3);
    for (var i = 0; i < sampleCount; i++) {
      final page = await doc.pages[i].ensureLoaded();
      final fullWidth = math.min(160.0, page.width);
      final fullHeight = fullWidth * (page.height / math.max(page.width, 1));
      final image = await page.render(
        fullWidth: fullWidth,
        fullHeight: fullHeight,
      );
      if (image == null) {
        continue;
      }
      try {
        if (_pixelsLookColor(image.pixels, image.width, image.height)) {
          isColor = true;
          break;
        }
      } finally {
        image.dispose();
      }
    }

    return PdfDocumentInfo(pages: pages < 1 ? 1 : pages, isColor: isColor);
  } finally {
    await doc.dispose();
  }
}

Future<PdfDocumentInfo> analyzePdfSafe(String filePath) async {
  try {
    return await analyzePdf(filePath);
  } catch (_) {
    try {
      final bytes = await File(filePath).readAsBytes();
      return PdfDocumentInfo(
        pages: estimatePdfPagesFromBytes(bytes),
        isColor: false,
      );
    } catch (_) {
      return const PdfDocumentInfo(pages: 1, isColor: false);
    }
  }
}

/// Fallback page count from raw bytes when the native parser is unavailable.
int estimatePdfPagesFromBytes(Uint8List bytes) {
  final text = String.fromCharCodes(bytes);
  final matches = RegExp(r'/Type\s*/Page(?!\w)').allMatches(text).length;
  return matches > 0 ? matches : 1;
}

bool _pixelsLookColor(Uint8List pixels, int width, int height) {
  if (pixels.isEmpty || width <= 0 || height <= 0) {
    return false;
  }

  var sampled = 0;
  var colorful = 0;
  // BGRA bytes from pdfrx.
  const stride = 4;
  final step = math.max(4, (width * height) ~/ 2500) * stride;

  for (var i = 0; i + 3 < pixels.length; i += step) {
    final b = pixels[i];
    final g = pixels[i + 1];
    final r = pixels[i + 2];
    final a = pixels[i + 3];
    if (a < 20) {
      continue;
    }
    sampled += 1;
    final maxc = math.max(r, math.max(g, b));
    final minc = math.min(r, math.min(g, b));
    if (maxc - minc >= 28) {
      colorful += 1;
    }
  }

  if (sampled == 0) {
    return false;
  }
  // Mark as color if ~1.2%+ of sampled pixels are chromatic.
  return colorful / sampled >= 0.012;
}

@Deprecated('Use analyzePdfSafe')
Future<int> countPdfPagesSafe(String filePath) async {
  final info = await analyzePdfSafe(filePath);
  return info.pages;
}
