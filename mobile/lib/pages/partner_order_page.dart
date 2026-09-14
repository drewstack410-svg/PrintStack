import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../components/buttons/gradient_button.dart';
import '../components/common/message_banner.dart';
import '../components/common/price_row.dart';
import '../components/common/section_title.dart';
import '../components/common/status_chip.dart';
import '../models/partner.dart';
import '../theme.dart';
import '../utils/pdf_pages.dart';

class PartnerOrderPage extends StatefulWidget {
  const PartnerOrderPage({super.key, required this.partner});

  final Partner partner;

  @override
  State<PartnerOrderPage> createState() => _PartnerOrderPageState();
}

class _PartnerOrderPageState extends State<PartnerOrderPage> {
  PlatformFile? _picked;
  PaperSize? _selectedSize;
  int _copies = 1;
  int _bwPages = 0;
  int _colorPages = 0;
  bool _colorDetected = false;
  bool _readingPdf = false;
  bool _submitting = false;
  String? _error;
  String? _success;

  List<PaperSize> get _sizes => widget.partner.paperSizes;

  int get _totalPages => _bwPages + _colorPages;

  double get _bwUnit => _selectedSize?.priceBw ?? 0;
  double get _colorUnit => _selectedSize?.priceColor ?? 0;

  double get _bwSubtotal => _bwPages * _copies * _bwUnit;
  double get _colorSubtotal => _colorPages * _copies * _colorUnit;
  double get _total => _bwSubtotal + _colorSubtotal;

  String get _pageBreakdown {
    if (_colorPages > 0 && _bwPages > 0) {
      return '$_bwPages B&W · $_colorPages color';
    }
    if (_colorPages > 0) {
      return '$_colorPages color page${_colorPages == 1 ? '' : 's'}';
    }
    if (_bwPages > 0) {
      return '$_bwPages B&W page${_bwPages == 1 ? '' : 's'}';
    }
    return 'No pages detected';
  }

  String get _colorModeLabel {
    if (_colorPages > 0 && _bwPages > 0) {
      return 'Mixed';
    }
    if (_colorPages > 0) {
      return 'Color';
    }
    return 'Black & white';
  }

  @override
  void initState() {
    super.initState();
    if (_sizes.isNotEmpty) {
      _selectedSize = _sizes.first;
    }
  }

  void _resetDetection() {
    _bwPages = 0;
    _colorPages = 0;
    _colorDetected = false;
  }

  Future<void> _pickPdf() async {
    setState(() {
      _error = null;
      _success = null;
    });

    final files = await FilePicker.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ['pdf'],
    );

    if (files.isEmpty) {
      return;
    }

    final file = files.first;
    if ((file.path ?? '').isEmpty) {
      setState(() => _error = 'Could not read that PDF file.');
      return;
    }

    setState(() {
      _picked = file;
      _readingPdf = true;
      _resetDetection();
    });

    final info = await analyzePdfSafe(file.path!);
    if (!mounted) {
      return;
    }

    setState(() {
      _bwPages = info.bwPages;
      _colorPages = info.colorPages;
      _colorDetected = true;
      _readingPdf = false;
    });
  }

  void _forceAllBw() {
    setState(() {
      _bwPages = _totalPages;
      _colorPages = 0;
    });
  }

  void _forceAllColor() {
    setState(() {
      _colorPages = _totalPages;
      _bwPages = 0;
    });
  }

  Future<void> _submit() async {
    final size = _selectedSize;
    final picked = _picked;
    if (picked == null || (picked.path ?? '').isEmpty) {
      setState(() => _error = 'Choose a PDF document first.');
      return;
    }
    if (size == null) {
      setState(() => _error = 'Choose a paper layout first.');
      return;
    }
    if (_totalPages < 1) {
      setState(() => _error = 'No pages detected in that PDF.');
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
      _success = null;
    });

    try {
      final upload = await ApiClient.instance.uploadPrintPdf(
        partnerId: widget.partner.id,
        file: File(picked.path!),
        fileName: picked.name,
      );

      await ApiClient.instance.createCustomerPrintJob(
        partnerId: widget.partner.id,
        documentName: picked.name,
        fileUrl: upload.fileUrl,
        filePath: upload.filePath,
        paperSizeId: size.id,
        copies: _copies,
        pages: _totalPages,
        bwPages: _bwPages,
        colorPages: _colorPages,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _success =
            'Uploaded $_pageBreakdown. Waiting for partner desktop.';
        _picked = null;
        _resetDetection();
      });
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _submitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final partner = widget.partner;
    final online = partner.location?.online == true;

    return Scaffold(
      appBar: AppBar(
        title: Text(partner.companyName.isEmpty ? 'Partner' : partner.companyName),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          StatusChip(
            label: online ? 'Partner online' : 'Partner offline',
            active: online,
          ),
          const SizedBox(height: 8),
          Text(
            online
                ? 'Upload a PDF and it will print on their desktop app.'
                : 'You can still upload. Printing starts when their desktop comes online.',
            style: const TextStyle(color: AppColors.muted, height: 1.4),
          ),
          const SizedBox(height: 24),
          const SectionTitle('1. Document'),
          const SizedBox(height: 10),
          Material(
            color: Colors.white,
            borderRadius: BorderRadius.circular(16),
            child: InkWell(
              borderRadius: BorderRadius.circular(16),
              onTap: _submitting || _readingPdf ? null : _pickPdf,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(
                      Icons.picture_as_pdf_outlined,
                      color: AppColors.purple,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _picked?.name ?? 'Choose PDF',
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              color: _picked == null
                                  ? AppColors.muted
                                  : AppColors.navy,
                            ),
                          ),
                          if (_picked != null) ...[
                            const SizedBox(height: 4),
                            Text(
                              _readingPdf
                                  ? 'Counting B&W and color pages…'
                                  : _pageBreakdown,
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 13,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    if (_readingPdf)
                      const SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    else
                      const Icon(Icons.upload_file, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ),
          if (_picked != null && !_readingPdf) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Icon(
                        _colorPages > 0
                            ? Icons.palette_outlined
                            : Icons.filter_b_and_w,
                        color: _colorPages > 0
                            ? AppColors.purple
                            : AppColors.navy,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _colorModeLabel,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                color: AppColors.navy,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              _colorDetected
                                  ? 'Counted every page from the PDF'
                                  : 'Could not fully analyze; priced as B&W',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _submitting ||
                                  _totalPages < 1 ||
                                  _bwPages == _totalPages
                              ? null
                              : _forceAllBw,
                          child: const Text('All B&W'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _submitting ||
                                  _totalPages < 1 ||
                                  _colorPages == _totalPages
                              ? null
                              : _forceAllColor,
                          child: const Text('All Color'),
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 24),
          const SectionTitle('2. Layout'),
          const SizedBox(height: 10),
          if (_sizes.isEmpty)
            Container(
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: const Text(
                'This partner has not set paper sizes yet.',
                style: TextStyle(color: AppColors.muted),
              ),
            )
          else
            ..._sizes.map((item) {
              final selected = _selectedSize?.id == item.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: _submitting
                        ? null
                        : () => setState(() => _selectedSize = item),
                    child: Container(
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: selected
                              ? AppColors.purple
                              : Colors.transparent,
                          width: 1.6,
                        ),
                      ),
                      child: Row(
                        children: [
                          Icon(
                            selected
                                ? Icons.radio_button_checked
                                : Icons.radio_button_off,
                            color: selected
                                ? AppColors.purple
                                : AppColors.muted,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  item.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  '${item.sizeLabel}\nB&W ₱${item.priceBw.toStringAsFixed(2)} · Color ₱${item.priceColor.toStringAsFixed(2)}',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 13,
                                    height: 1.35,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }),
          const SizedBox(height: 14),
          const SectionTitle('3. Copies'),
          const SizedBox(height: 10),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                IconButton(
                  onPressed: _submitting || _copies <= 1
                      ? null
                      : () => setState(() => _copies -= 1),
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Expanded(
                  child: Text(
                    '$_copies',
                    textAlign: TextAlign.center,
                    style: const TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
                  ),
                ),
                IconButton(
                  onPressed: _submitting || _copies >= 50
                      ? null
                      : () => setState(() => _copies += 1),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ),
          const SizedBox(height: 24),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                PriceRow(
                  label: 'B&W pages',
                  value:
                      '$_bwPages × $_copies × ₱${_bwUnit.toStringAsFixed(2)} = ₱${_bwSubtotal.toStringAsFixed(2)}',
                ),
                const SizedBox(height: 8),
                PriceRow(
                  label: 'Color pages',
                  value:
                      '$_colorPages × $_copies × ₱${_colorUnit.toStringAsFixed(2)} = ₱${_colorSubtotal.toStringAsFixed(2)}',
                ),
                const Divider(height: 24),
                Row(
                  children: [
                    const Text(
                      'Estimated total',
                      style: TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                    const Spacer(),
                    Text(
                      '₱${_total.toStringAsFixed(2)}',
                      style: const TextStyle(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                        color: AppColors.purple,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            MessageBanner(message: _error!, isError: true),
          ],
          if (_success != null) ...[
            const SizedBox(height: 14),
            MessageBanner(message: _success!),
          ],
          const SizedBox(height: 18),
          GradientButton(
            label: 'Upload & send to print',
            busy: _submitting,
            onPressed: _submitting || _readingPdf || _sizes.isEmpty
                ? null
                : _submit,
          ),
        ],
      ),
    );
  }
}
