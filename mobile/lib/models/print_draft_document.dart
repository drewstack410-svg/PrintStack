import 'partner.dart';

/// Local-only document ready for the print queue (not uploaded yet).
class PrintDraftDocument {
  const PrintDraftDocument({
    required this.path,
    required this.fileName,
    required this.paperSize,
    required this.copies,
    required this.bwPages,
    required this.colorPages,
    required this.pageIsColor,
    this.forceBlackAndWhite = false,
  });

  final String path;
  final String fileName;
  final PaperSize paperSize;
  final int copies;
  /// Detected B&W page count from the PDF.
  final int bwPages;
  /// Detected color page count from the PDF.
  final int colorPages;
  final List<bool> pageIsColor;
  /// When true, color pages are billed/ordered as B&W.
  final bool forceBlackAndWhite;

  int get totalPages => bwPages + colorPages;

  int get billedBwPages => forceBlackAndWhite ? totalPages : bwPages;

  int get billedColorPages => forceBlackAndWhite ? 0 : colorPages;

  bool get hasDetectedColor => colorPages > 0;

  String get colorMode =>
      billedColorPages > 0 && billedBwPages > 0
          ? 'mixed'
          : billedColorPages > 0
              ? 'color'
              : 'bw';

  double get lineTotal {
    final bw = billedBwPages * copies * paperSize.priceBw;
    final color = billedColorPages * copies * paperSize.priceColor;
    return bw + color;
  }

  String get pageBreakdown {
    if (forceBlackAndWhite && hasDetectedColor) {
      return '$totalPages B&W (color as B&W)';
    }
    if (billedColorPages > 0 && billedBwPages > 0) {
      return '$billedBwPages B&W · $billedColorPages color';
    }
    if (billedColorPages > 0) {
      return '$billedColorPages color page${billedColorPages == 1 ? '' : 's'}';
    }
    if (billedBwPages > 0) {
      return '$billedBwPages B&W page${billedBwPages == 1 ? '' : 's'}';
    }
    return 'No pages';
  }

  PrintDraftDocument copyWith({
    int? copies,
    bool? forceBlackAndWhite,
  }) {
    return PrintDraftDocument(
      path: path,
      fileName: fileName,
      paperSize: paperSize,
      copies: copies ?? this.copies,
      bwPages: bwPages,
      colorPages: colorPages,
      pageIsColor: pageIsColor,
      forceBlackAndWhite: forceBlackAndWhite ?? this.forceBlackAndWhite,
    );
  }
}
