import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:pdfrx/pdfrx.dart';

class PdfDocumentInfo {
  const PdfDocumentInfo({
    required this.pages,
    required this.isColor,
    this.detectionSource = 'pixels',
  });

  final int pages;
  final bool isColor;
  final String detectionSource;
}

/// Returns page count and whether the PDF appears to contain color.
Future<PdfDocumentInfo> analyzePdf(String filePath) async {
  final doc = await PdfDocument.openFile(filePath);
  try {
    final pages = doc.pages.isEmpty ? 1 : doc.pages.length;
    var isColor = false;
    var renderedAny = false;

    // Sample more pages at a higher resolution for better color detection.
    final sampleCount = math.min(pages, 5);
    for (var i = 0; i < sampleCount; i++) {
      final page = await doc.pages[i].ensureLoaded();
      final fullWidth = 240.0;
      final fullHeight = fullWidth * (page.height / math.max(page.width, 1));
      final image = await page.render(
        fullWidth: fullWidth,
        fullHeight: fullHeight,
      );
      if (image == null) {
        continue;
      }
      renderedAny = true;
      try {
        if (_pixelsLookColor(image.pixels, image.width, image.height)) {
          isColor = true;
          break;
        }
      } finally {
        image.dispose();
      }
    }

    // If rendering failed, fall back to PDF content heuristics.
    if (!renderedAny) {
      final bytes = await File(filePath).readAsBytes();
      return PdfDocumentInfo(
        pages: pages < 1 ? 1 : pages,
        isColor: _bytesSuggestColor(bytes),
        detectionSource: 'content',
      );
    }

    return PdfDocumentInfo(
      pages: pages < 1 ? 1 : pages,
      isColor: isColor,
      detectionSource: 'pixels',
    );
  } finally {
    await doc.dispose();
  }
}

Future<PdfDocumentInfo> analyzePdfSafe(String filePath) async {
  try {
    return await analyzePdf(filePath);
  } catch (error, stack) {
    debugPrint('PDF color analysis failed: $error\n$stack');
    try {
      final bytes = await File(filePath).readAsBytes();
      return PdfDocumentInfo(
        pages: estimatePdfPagesFromBytes(bytes),
        isColor: _bytesSuggestColor(bytes),
        detectionSource: 'content',
      );
    } catch (_) {
      return const PdfDocumentInfo(pages: 1, isColor: false, detectionSource: 'fallback');
    }
  }
}

/// Fallback page count from raw bytes when the native parser is unavailable.
int estimatePdfPagesFromBytes(Uint8List bytes) {
  final text = String.fromCharCodes(bytes);
  final matches = RegExp(r'/Type\s*/Page(?!\w)').allMatches(text).length;
  return matches > 0 ? matches : 1;
}

bool _bytesSuggestColor(Uint8List bytes) {
  // Rough content-stream heuristic for when page rendering is unavailable.
  final text = String.fromCharCodes(bytes);
  final colorHints = RegExp(
    r'/DeviceRGB|/DeviceCMYK|/ICCBased|/Separation|/ColorSpace\s*/|/CS\s*/DeviceRGB|rg\s|RG\s|k\s|K\s',
    caseSensitive: false,
  );
  final grayHints = RegExp(
    r'/DeviceGray|/G\s|g\s',
    caseSensitive: false,
  );
  final colorHits = colorHints.allMatches(text).length;
  final grayHits = grayHints.allMatches(text).length;
  return colorHits > 0 && colorHits >= grayHits;
}

bool _pixelsLookColor(Uint8List pixels, int width, int height) {
  if (pixels.isEmpty || width <= 0 || height <= 0) {
    return false;
  }

  var sampled = 0;
  var colorful = 0;
  // BGRA bytes from pdfrx.
  const stride = 4;
  final step = math.max(stride, ((width * height) ~/ 4000) * stride);

  for (var i = 0; i + 3 < pixels.length; i += step) {
    final b = pixels[i];
    final g = pixels[i + 1];
    final r = pixels[i + 2];
    final a = pixels[i + 3];
    if (a < 30) {
      continue;
    }

    // Ignore near-white / near-black ink noise.
    final maxc = math.max(r, math.max(g, b));
    final minc = math.min(r, math.min(g, b));
    if (maxc < 18 || minc > 245) {
      continue;
    }

    sampled += 1;
    final chroma = maxc - minc;
    // Also catch tinted grays / soft color fills.
    if (chroma >= 18) {
      colorful += 1;
    }
  }

  if (sampled == 0) {
    return false;
  }
  // Mark as color if enough sampled pixels are chromatic.
  return colorful / sampled >= 0.008;
}
