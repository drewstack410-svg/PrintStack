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
  });

  final String path;
  final String fileName;
  final PaperSize paperSize;
  final int copies;
  final int bwPages;
  final int colorPages;
  final List<bool> pageIsColor;

  int get totalPages => bwPages + colorPages;

  double get lineTotal {
    final bw = bwPages * copies * paperSize.priceBw;
    final color = colorPages * copies * paperSize.priceColor;
    return bw + color;
  }

  String get pageBreakdown {
    if (colorPages > 0 && bwPages > 0) {
      return '$bwPages B&W · $colorPages color';
    }
    if (colorPages > 0) {
      return '$colorPages color page${colorPages == 1 ? '' : 's'}';
    }
    if (bwPages > 0) {
      return '$bwPages B&W page${bwPages == 1 ? '' : 's'}';
    }
    return 'No pages';
  }
}
