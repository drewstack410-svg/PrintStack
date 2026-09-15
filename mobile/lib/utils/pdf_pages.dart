import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/foundation.dart';
import 'package:pdfrx/pdfrx.dart';

class PdfDocumentInfo {
  const PdfDocumentInfo({
    required this.pages,
    required this.colorPages,
    required this.bwPages,
    this.detectionSource = 'pixels',
    this.pageWidthPt = 0,
    this.pageHeightPt = 0,
    this.pageIsColor = const [],
  });

  final int pages;
  final int colorPages;
  final int bwPages;
  final String detectionSource;
  /// First-page size in PDF points (1/72").
  final double pageWidthPt;
  final double pageHeightPt;
  /// Per-page color flags (index 0 = page 1).
  final List<bool> pageIsColor;

  bool get hasColor => colorPages > 0;
  bool get isMixed => colorPages > 0 && bwPages > 0;

  /// Legacy single-mode flag: true when any page looks colored.
  bool get isColor => hasColor;

  double get pageWidthMm => pageWidthPt * 25.4 / 72;
  double get pageHeightMm => pageHeightPt * 25.4 / 72;

  List<int> get colorPageNumbers => [
        for (var i = 0; i < pageIsColor.length; i++)
          if (pageIsColor[i]) i + 1,
      ];

  List<int> get bwPageNumbers => [
        for (var i = 0; i < pageIsColor.length; i++)
          if (!pageIsColor[i]) i + 1,
      ];
}

/// Returns page count and per-page B&W vs color classification.
Future<PdfDocumentInfo> analyzePdf(String filePath) async {
  final doc = await PdfDocument.openFile(filePath);
  try {
    final pages = doc.pages.isEmpty ? 1 : doc.pages.length;
    var colorPages = 0;
    var bwPages = 0;
    var renderedAny = false;
    var pageWidthPt = 0.0;
    var pageHeightPt = 0.0;
    final pageIsColor = <bool>[];

    for (var i = 0; i < pages; i++) {
      final page = await doc.pages[i].ensureLoaded();
      if (i == 0) {
        pageWidthPt = page.width;
        pageHeightPt = page.height;
      }
      final fullWidth = 200.0;
      final fullHeight = fullWidth * (page.height / math.max(page.width, 1));
      final image = await page.render(
        fullWidth: fullWidth,
        fullHeight: fullHeight,
      );
      if (image == null) {
        bwPages += 1;
        pageIsColor.add(false);
        continue;
      }
      renderedAny = true;
      try {
        final isColor = _pixelsLookColor(image.pixels, image.width, image.height);
        pageIsColor.add(isColor);
        if (isColor) {
          colorPages += 1;
        } else {
          bwPages += 1;
        }
      } finally {
        image.dispose();
      }
    }

    // If rendering failed entirely, fall back to PDF content heuristics.
    if (!renderedAny) {
      final bytes = await File(filePath).readAsBytes();
      final allColor = _bytesSuggestColor(bytes);
      final total = pages < 1 ? 1 : pages;
      return PdfDocumentInfo(
        pages: total,
        colorPages: allColor ? total : 0,
        bwPages: allColor ? 0 : total,
        detectionSource: 'content',
        pageWidthPt: pageWidthPt,
        pageHeightPt: pageHeightPt,
        pageIsColor: List<bool>.filled(total, allColor),
      );
    }

    final total = colorPages + bwPages;
    return PdfDocumentInfo(
      pages: total < 1 ? 1 : total,
      colorPages: colorPages,
      bwPages: bwPages < 1 && colorPages < 1 ? 1 : bwPages,
      detectionSource: 'pixels',
      pageWidthPt: pageWidthPt,
      pageHeightPt: pageHeightPt,
      pageIsColor: pageIsColor.isEmpty ? const [false] : pageIsColor,
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
      final pages = estimatePdfPagesFromBytes(bytes);
      final allColor = _bytesSuggestColor(bytes);
      final media = estimatePdfPageSizeFromBytes(bytes);
      return PdfDocumentInfo(
        pages: pages,
        colorPages: allColor ? pages : 0,
        bwPages: allColor ? 0 : pages,
        detectionSource: 'content',
        pageWidthPt: media.$1,
        pageHeightPt: media.$2,
        pageIsColor: List<bool>.filled(pages, allColor),
      );
    } catch (_) {
      return const PdfDocumentInfo(
        pages: 1,
        colorPages: 0,
        bwPages: 1,
        detectionSource: 'fallback',
        pageIsColor: [false],
      );
    }
  }
}

/// Fallback page count from raw bytes when the native parser is unavailable.
int estimatePdfPagesFromBytes(Uint8List bytes) {
  final text = String.fromCharCodes(bytes);
  final matches = RegExp(r'/Type\s*/Page(?!\w)').allMatches(text).length;
  return matches > 0 ? matches : 1;
}

/// Best-effort MediaBox size in PDF points.
(double, double) estimatePdfPageSizeFromBytes(Uint8List bytes) {
  final text = String.fromCharCodes(bytes);
  final match = RegExp(
    r'/MediaBox\s*\[\s*([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s+([0-9.]+)\s*\]',
  ).firstMatch(text);
  if (match == null) {
    return (0, 0);
  }
  final x0 = double.tryParse(match.group(1)!) ?? 0;
  final y0 = double.tryParse(match.group(2)!) ?? 0;
  final x1 = double.tryParse(match.group(3)!) ?? 0;
  final y1 = double.tryParse(match.group(4)!) ?? 0;
  return ((x1 - x0).abs(), (y1 - y0).abs());
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
