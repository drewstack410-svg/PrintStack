import 'dart:io';
import 'dart:math' as math;
import 'dart:typed_data';

import 'package:docx_creator/docx_creator.dart';
import 'package:file_preview_kit/file_preview_kit.dart' as fpk;
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/partner.dart';
import 'print_document_kind.dart';

class OfficePdfConversion {
  const OfficePdfConversion({
    required this.pdfPath,
    required this.fileName,
    this.paperSize,
  });

  final String pdfPath;
  final String fileName;
  final PaperSize? paperSize;
}

/// Converts Word/Excel uploads into a temporary PDF so preview shows real page breaks.
Future<OfficePdfConversion> convertOfficeFileToPdf({
  required String path,
  required String fileName,
  PaperSize? paperSize,
}) async {
  final kind = printDocumentKindForPath(path);
  if (kind != PrintDocumentKind.officeInline &&
      kind != PrintDocumentKind.officeNative) {
    throw StateError('Not an Office document');
  }

  final ext = _extension(path);
  if (ext == 'doc' || ext == 'xls') {
    throw UnsupportedError(
      'Please upload a .docx or .xlsx file (older .doc/.xls need conversion first).',
    );
  }

  final layout = paperSize ?? PaperSize.defaults.first;
  final Uint8List bytes;
  if (ext == 'docx') {
    bytes = await _docxToPdfBytes(path, layout);
  } else if (ext == 'xlsx') {
    bytes = await _xlsxToPdfBytes(path, layout);
  } else {
    throw UnsupportedError('Unsupported Office format: .$ext');
  }

  final dir = await getTemporaryDirectory();
  final outName = _pdfNameFrom(fileName);
  final out = File(
    '${dir.path}/office_${DateTime.now().millisecondsSinceEpoch}_$outName',
  );
  await out.writeAsBytes(bytes, flush: true);

  return OfficePdfConversion(
    pdfPath: out.path,
    fileName: outName,
    paperSize: layout,
  );
}

Future<Uint8List> _docxToPdfBytes(String path, PaperSize layout) async {
  final page = _pagePoints(layout);
  final margin = math.min(54.0, page.width * 0.08);
  final contentWidth = page.width - margin * 2;
  final doc = await DocxReader.load(path);
  final normalized = _normalizeDocxImages(doc, contentWidth);
  return PdfExporter(
    pageWidth: page.width,
    pageHeight: page.height,
    marginTop: math.min(54, page.height * 0.08),
    marginBottom: math.min(54, page.height * 0.08),
    marginLeft: margin,
    marginRight: margin,
  ).exportToBytes(normalized);
}

/// docx_creator's PDF exporter doesn't wrap text around floating/inline images,
/// so side-by-side Word layouts overlap. Pull those images into a 2-column
/// (or stacked) layout before export.
DocxBuiltDocument _normalizeDocxImages(
  DocxBuiltDocument doc,
  double contentWidth,
) {
  final out = <DocxNode>[];
  for (final node in doc.elements) {
    out.addAll(_expandNodeForPdf(node, contentWidth));
  }
  return DocxBuiltDocument(
    elements: out,
    section: doc.section,
    fonts: doc.fonts,
    footnotes: doc.footnotes,
    endnotes: doc.endnotes,
    stylesXml: doc.stylesXml,
    numberingXml: doc.numberingXml,
    settingsXml: doc.settingsXml,
    fontTableXml: doc.fontTableXml,
    fontTableRelsXml: doc.fontTableRelsXml,
    themeXml: doc.themeXml,
    contentTypesXml: doc.contentTypesXml,
    rootRelsXml: doc.rootRelsXml,
    headerBgXml: doc.headerBgXml,
    headerBgRelsXml: doc.headerBgRelsXml,
    footnotesXml: doc.footnotesXml,
    endnotesXml: doc.endnotesXml,
    numberingRelsXml: doc.numberingRelsXml,
    numberingImages: doc.numberingImages,
    theme: doc.theme,
  );
}

List<DocxNode> _expandNodeForPdf(DocxNode node, double contentWidth) {
  if (node is DocxParagraph) {
    return _expandParagraphForPdf(node, contentWidth);
  }
  if (node is DocxTable) {
    return [
      DocxTable(
        rows: [
          for (final row in node.rows)
            DocxTableRow(
              cells: [
                for (final cell in row.cells)
                  DocxTableCell(
                    children: [
                      for (final child in cell.children)
                        ..._expandNodeForPdf(child, contentWidth)
                            .whereType<DocxBlock>(),
                    ],
                    colSpan: cell.colSpan,
                    rowSpan: cell.rowSpan,
                    verticalAlign: cell.verticalAlign,
                    shadingFill: cell.shadingFill,
                    width: cell.width,
                  ),
              ],
              height: row.height,
              isHeader: row.isHeader,
            ),
        ],
        style: node.style,
        hasHeader: node.hasHeader,
        alignment: node.alignment,
        width: node.width,
        widthType: node.widthType,
        styleId: node.styleId,
        gridColumns: node.gridColumns,
      ),
    ];
  }
  return [node];
}

List<DocxNode> _expandParagraphForPdf(
  DocxParagraph paragraph,
  double contentWidth,
) {
  final images = paragraph.children.whereType<DocxInlineImage>().toList();
  if (images.isEmpty) {
    return [paragraph];
  }

  final needsSplit = images.any(_imageNeedsLayoutFix);
  if (!needsSplit) {
    return [paragraph];
  }

  final before = <DocxInline>[];
  final after = <DocxInline>[];
  DocxInlineImage? primary;
  var pastImage = false;

  for (final child in paragraph.children) {
    if (child is DocxInlineImage &&
        primary == null &&
        _imageNeedsLayoutFix(child)) {
      primary = child;
      pastImage = true;
      continue;
    }
    if (!pastImage) {
      before.add(child);
    } else {
      after.add(child);
    }
  }

  if (primary == null) {
    return [paragraph];
  }

  final nodes = <DocxNode>[];
  final wrap = primary.textWrap;
  final floating = primary.positionMode == DocxDrawingPosition.floating;
  final sideBySide = floating &&
      (wrap == DocxTextWrap.square ||
          wrap == DocxTextWrap.tight ||
          wrap == DocxTextWrap.through);

  if (sideBySide) {
    final imageOnRight = primary.hAlign != DrawingHAlign.left;
    final imageWidth = math.min(primary.width, contentWidth * 0.48);
    final scale = primary.width <= 0 ? 1.0 : imageWidth / primary.width;
    final imageHeight = primary.height * scale;
    final blockImage = DocxImage(
      bytes: primary.bytes,
      extension: primary.extension,
      width: imageWidth,
      height: imageHeight,
      altText: primary.altText,
      border: primary.border,
      align: DocxAlign.center,
    );

    final textBlocks = <DocxBlock>[
      if (before.isNotEmpty) _copyParagraph(paragraph, before),
      if (after.isNotEmpty) _copyParagraph(paragraph, after),
    ];
    if (textBlocks.isEmpty) {
      nodes.add(blockImage);
      return nodes;
    }

    final textCell = DocxTableCell(
      children: textBlocks,
      verticalAlign: DocxVerticalAlign.top,
    );
    final imageCell = DocxTableCell(
      children: [blockImage],
      verticalAlign: DocxVerticalAlign.top,
    );

    nodes.add(
      DocxTable(
        style: DocxTableStyle.plain,
        rows: [
          DocxTableRow(
            cells: imageOnRight ? [textCell, imageCell] : [imageCell, textCell],
          ),
        ],
      ),
    );
    return nodes;
  }

  if (before.isNotEmpty) {
    nodes.add(_copyParagraph(paragraph, before));
  }
  final maxW = contentWidth * 0.92;
  final scale = primary.width > maxW && primary.width > 0
      ? maxW / primary.width
      : 1.0;
  nodes.add(
    DocxImage(
      bytes: primary.bytes,
      extension: primary.extension,
      width: primary.width * scale,
      height: primary.height * scale,
      altText: primary.altText,
      border: primary.border,
      align: DocxAlign.center,
    ),
  );
  if (after.isNotEmpty) {
    nodes.add(_copyParagraph(paragraph, after));
  }

  // Remaining large images in "after" (rare) — flatten recursively.
  final rebuilt = <DocxNode>[];
  for (final node in nodes) {
    if (node is DocxParagraph &&
        node.children.whereType<DocxInlineImage>().any(_imageNeedsLayoutFix)) {
      rebuilt.addAll(_expandParagraphForPdf(node, contentWidth));
    } else {
      rebuilt.add(node);
    }
  }
  return rebuilt;
}

bool _imageNeedsLayoutFix(DocxInlineImage image) {
  if (image.positionMode == DocxDrawingPosition.floating) {
    return true;
  }
  // Tall/wide inline images also cause the PDF exporter to overlap following text.
  return image.height > 40 || image.width > 140;
}

DocxParagraph _copyParagraph(
  DocxParagraph source,
  List<DocxInline> children,
) {
  return DocxParagraph(
    children: children,
    align: source.align,
    textAlignment: source.textAlignment,
    styleId: source.styleId,
    spacingAfter: source.spacingAfter,
    spacingBefore: source.spacingBefore,
    lineSpacing: source.lineSpacing,
    lineRule: source.lineRule,
    indentLeft: source.indentLeft,
    indentRight: source.indentRight,
    indentFirstLine: source.indentFirstLine,
    borderTop: source.borderTop,
    borderBottomSide: source.borderBottomSide,
    borderLeft: source.borderLeft,
    borderRight: source.borderRight,
    borderBetween: source.borderBetween,
    paddingTop: source.paddingTop,
    paddingBottom: source.paddingBottom,
    paddingLeft: source.paddingLeft,
    paddingRight: source.paddingRight,
    borderRadius: source.borderRadius,
    shadingFill: source.shadingFill,
    themeFill: source.themeFill,
    themeFillTint: source.themeFillTint,
    themeFillShade: source.themeFillShade,
    outlineLevel: source.outlineLevel,
    pageBreakBefore: source.pageBreakBefore,
    numId: source.numId,
    ilvl: source.ilvl,
    cnfStyle: source.cnfStyle,
  );
}

Future<Uint8List> _xlsxToPdfBytes(String path, PaperSize layout) async {
  final bytes = await File(path).readAsBytes();
  final workbook = fpk.XlsxParser().parseBytes(bytes);
  final format = _pdfPageFormat(layout);
  final pdf = pw.Document();

  if (workbook.sheets.isEmpty) {
    pdf.addPage(
      pw.Page(
        pageFormat: format,
        build: (_) => pw.Center(child: pw.Text('Empty spreadsheet')),
      ),
    );
  } else {
    for (final sheet in workbook.sheets) {
      final maxCols = math.min(sheet.columnCount, 12);
      final tableRows = <pw.TableRow>[];

      tableRows.add(
        pw.TableRow(
          decoration: const pw.BoxDecoration(color: PdfColors.grey300),
          children: [
            for (var c = 0; c < maxCols; c++)
              _cell(_columnLabel(c), bold: true),
          ],
        ),
      );

      for (var r = 0; r < sheet.rows.length; r++) {
        final row = sheet.rows[r];
        tableRows.add(
          pw.TableRow(
            children: [
              for (var c = 0; c < maxCols; c++)
                _cell(c < row.length ? row[c].displayValue : ''),
            ],
          ),
        );
      }

      pdf.addPage(
        pw.MultiPage(
          pageFormat: format,
          margin: const pw.EdgeInsets.all(28),
          header: (context) => pw.Padding(
            padding: const pw.EdgeInsets.only(bottom: 10),
            child: pw.Text(
              sheet.name,
              style: pw.TextStyle(
                fontSize: 11,
                fontWeight: pw.FontWeight.bold,
              ),
            ),
          ),
          build: (context) => [
            pw.Table(
              border: pw.TableBorder.all(
                color: PdfColors.grey600,
                width: 0.4,
              ),
              columnWidths: {
                for (var i = 0; i < maxCols; i++)
                  i: const pw.FlexColumnWidth(1),
              },
              children: tableRows,
            ),
          ],
        ),
      );
    }
  }

  return pdf.save();
}

pw.Widget _cell(String text, {bool bold = false}) {
  return pw.Padding(
    padding: const pw.EdgeInsets.symmetric(horizontal: 3, vertical: 2),
    child: pw.Text(
      text,
      style: pw.TextStyle(
        fontSize: 7.5,
        fontWeight: bold ? pw.FontWeight.bold : pw.FontWeight.normal,
      ),
      maxLines: 4,
    ),
  );
}

String _columnLabel(int index) {
  var n = index;
  final chars = <int>[];
  do {
    chars.add(65 + (n % 26));
    n = (n ~/ 26) - 1;
  } while (n >= 0);
  return String.fromCharCodes(chars.reversed);
}

({double width, double height}) _pagePoints(PaperSize size) {
  final w = size.unit == 'in' ? size.width * 72 : size.width * 72 / 25.4;
  final h = size.unit == 'in' ? size.height * 72 : size.height * 72 / 25.4;
  return (width: math.max(w, 1), height: math.max(h, 1));
}

PdfPageFormat _pdfPageFormat(PaperSize size) {
  final page = _pagePoints(size);
  return PdfPageFormat(page.width, page.height);
}

String _pdfNameFrom(String fileName) {
  final base = fileName.trim().isEmpty ? 'document' : fileName.trim();
  final withoutExt = base.contains('.')
      ? base.substring(0, base.lastIndexOf('.'))
      : base;
  final cleaned = withoutExt
      .replaceAll(RegExp(r'[^\w.\- ]+', unicode: true), '_')
      .replaceAll(RegExp(r'\s+'), ' ')
      .trim();
  final safe = cleaned.isEmpty ? 'document' : cleaned;
  return safe.toLowerCase().endsWith('.pdf') ? safe : '$safe.pdf';
}

String _extension(String path) {
  final normalized = path.replaceAll('\\', '/');
  final dot = normalized.lastIndexOf('.');
  if (dot == -1 || dot == normalized.length - 1) {
    return '';
  }
  return normalized.substring(dot + 1).toLowerCase();
}
