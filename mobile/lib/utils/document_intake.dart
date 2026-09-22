import 'package:doc_scan_flutter/doc_scan.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../models/partner.dart';
import '../pages/document_layout_canvas_page.dart';
import '../theme.dart';
import 'office_to_pdf.dart';
import 'print_document_kind.dart';

class PickedPrintDocument {
  const PickedPrintDocument({
    required this.path,
    required this.name,
    this.paperSize,
  });

  final String path;
  final String name;
  final PaperSize? paperSize;
}

const _uploadableExtensions = <String>[
  'pdf',
  'png',
  'jpg',
  'jpeg',
  'docx',
];

bool _isImagePath(String path) {
  return printDocumentKindForPath(path) == PrintDocumentKind.image;
}

Future<String?> showDocumentSourceDialog(BuildContext context) {
  return showDialog<String>(
    context: context,
    builder: (context) {
      return AlertDialog(
        title: const Text('Add document'),
        contentPadding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
        content: SizedBox(
          width: double.maxFinite,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'How do you want to add your document?',
                style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w600,
                  color: AppColors.muted.withValues(alpha: 0.95),
                ),
              ),
              const SizedBox(height: 16),
              _DocumentSourceOptionCard(
                icon: Icons.upload_file_rounded,
                title: 'Upload file',
                subtitle: 'PDF, Word (.docx), or image',
                onTap: () => Navigator.pop(context, 'upload'),
              ),
              const SizedBox(height: 8),
              Text(
                'For better accuracy, upload a PDF version of your document.',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.muted,
                  fontWeight: FontWeight.w600,
                ),
              ),
              const SizedBox(height: 12),
              _DocumentSourceOptionCard(
                icon: Icons.document_scanner_outlined,
                title: 'Scan document',
                subtitle: 'Capture pages with your camera',
                onTap: () => Navigator.pop(context, 'scan'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
        ],
      );
    },
  );
}

class _DocumentSourceOptionCard extends StatelessWidget {
  const _DocumentSourceOptionCard({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      elevation: 1,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 20),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(18),
            border: Border.all(
              color: AppColors.purple.withValues(alpha: 0.28),
              width: 1.5,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 64,
                height: 64,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AppTheme.brandGradient,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.purple.withValues(alpha: 0.22),
                      blurRadius: 12,
                      offset: const Offset(0, 5),
                    ),
                  ],
                ),
                child: Icon(icon, size: 28, color: Colors.white),
              ),
              const SizedBox(height: 14),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                subtitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 12,
                  color: AppColors.muted.withValues(alpha: 0.95),
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

Future<PickedPrintDocument?> pickUploadDocument() async {
  final files = await FilePicker.pickFiles(
    type: FileType.custom,
    allowedExtensions: _uploadableExtensions,
  );
  if (files.isEmpty) {
    return null;
  }
  final file = files.first;
  final path = file.path ?? '';
  if (path.isEmpty) {
    return null;
  }
  return PickedPrintDocument(path: path, name: file.name);
}

Future<PickedPrintDocument?> customizeImageDocument(
  BuildContext context, {
  required String imagePath,
  required List<PaperSize> layouts,
  PaperSize? initialLayout,
}) async {
  if (imagePath.trim().isEmpty || !context.mounted) {
    return null;
  }

  final layoutResult = await Navigator.of(context).push<DocumentLayoutResult>(
    MaterialPageRoute(
      builder: (_) => DocumentLayoutCanvasPage(
        imagePath: imagePath,
        layouts: layouts.isEmpty ? PaperSize.defaults : layouts,
        initialLayout: initialLayout,
      ),
    ),
  );
  if (layoutResult == null) {
    return null;
  }

  return PickedPrintDocument(
    path: layoutResult.pdfPath,
    name: layoutResult.fileName,
    paperSize: layoutResult.paperSize,
  );
}

Future<PickedPrintDocument?> scanDocumentWithLayout(
  BuildContext context, {
  required List<PaperSize> layouts,
  PaperSize? initialLayout,
}) async {
  try {
    final results = await DocumentScanner.scan(format: DocScanFormat.jpeg);
    if (results == null || results.isEmpty) {
      return null;
    }

    final imagePath = results.firstWhere(
      (path) =>
          path.toLowerCase().endsWith('.jpg') ||
          path.toLowerCase().endsWith('.jpeg') ||
          path.toLowerCase().endsWith('.png'),
      orElse: () => results.first,
    );
    return customizeImageDocument(
      context,
      imagePath: imagePath,
      layouts: layouts,
      initialLayout: initialLayout,
    );
  } on DocumentScannerException catch (error) {
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            error.message.isEmpty
                ? 'Could not scan that document.'
                : error.message,
          ),
        ),
      );
    }
    return null;
  } catch (error) {
    debugPrint('Document scan failed: $error');
    if (context.mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Could not scan that document.')),
      );
    }
    return null;
  }
}

Future<PickedPrintDocument?> intakePrintDocument(
  BuildContext context, {
  required List<PaperSize> layouts,
  PaperSize? initialLayout,
}) async {
  final choice = await showDocumentSourceDialog(context);
  if (!context.mounted) {
    return null;
  }
  if (choice == 'upload') {
    final picked = await pickUploadDocument();
    if (picked == null || !context.mounted) {
      return picked;
    }
    if (_isImagePath(picked.path)) {
      return customizeImageDocument(
        context,
        imagePath: picked.path,
        layouts: layouts,
        initialLayout: initialLayout,
      );
    }
    final kind = printDocumentKindForPath(picked.path);
    if (kind == PrintDocumentKind.officeInline ||
        kind == PrintDocumentKind.officeNative) {
      showDialog<void>(
        context: context,
        barrierDismissible: false,
        builder: (_) => const AlertDialog(
          content: Row(
            children: [
              SizedBox(
                width: 28,
                height: 28,
                child: CircularProgressIndicator(strokeWidth: 2.5),
              ),
              SizedBox(width: 16),
              Expanded(child: Text('Converting to PDF…')),
            ],
          ),
        ),
      );
      try {
        final converted = await convertOfficeFileToPdf(
          path: picked.path,
          fileName: picked.name,
          paperSize:
              initialLayout ??
              (layouts.isNotEmpty ? layouts.first : PaperSize.defaults.first),
        );
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
        }
        if (!context.mounted) {
          return null;
        }
        return PickedPrintDocument(
          path: converted.pdfPath,
          name: converted.fileName,
          paperSize: converted.paperSize,
        );
      } catch (error) {
        if (context.mounted) {
          Navigator.of(context, rootNavigator: true).pop();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(
                error is UnsupportedError
                    ? error.message ?? 'Could not convert that file to PDF.'
                    : 'Could not convert that file to PDF.',
              ),
            ),
          );
        }
        return null;
      }
    }
    if (!isPrintableDocumentPath(picked.path)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('That file type is not supported.')),
      );
      return null;
    }
    return picked;
  }
  if (choice == 'scan') {
    return scanDocumentWithLayout(
      context,
      layouts: layouts,
      initialLayout: initialLayout,
    );
  }
  return null;
}
