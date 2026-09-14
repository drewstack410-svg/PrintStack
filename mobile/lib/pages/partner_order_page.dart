import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
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
  int _pages = 1;
  int _bwPages = 1;
  int _colorPages = 0;
  bool _colorDetected = false;
  bool _readingPdf = false;
  bool _submitting = false;
  String? _error;
  String? _success;

  List<PaperSize> get _sizes => widget.partner.paperSizes;

  double get _bwUnit => _selectedSize?.priceBw ?? 0;
  double get _colorUnit => _selectedSize?.priceColor ?? 0;

  double get _total {
    final pageTotal = (_bwPages * _bwUnit) + (_colorPages * _colorUnit);
    return pageTotal * _copies;
  }

  String get _pageBreakdown {
    if (_colorPages > 0 && _bwPages > 0) {
      return '$_bwPages B&W · $_colorPages color';
    }
    if (_colorPages > 0) {
      return '$_colorPages color page${_colorPages == 1 ? '' : 's'}';
    }
    return '$_bwPages B&W page${_bwPages == 1 ? '' : 's'}';
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

  void _resetDetection({int pages = 1}) {
    _pages = pages;
    _bwPages = pages;
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
      _pages = info.pages;
      _bwPages = info.bwPages;
      _colorPages = info.colorPages;
      _colorDetected = true;
      _readingPdf = false;
    });
  }

  void _forceAllBw() {
    setState(() {
      _bwPages = _pages;
      _colorPages = 0;
    });
  }

  void _forceAllColor() {
    setState(() {
      _colorPages = _pages;
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
        pages: _pages,
        bwPages: _bwPages,
        colorPages: _colorPages,
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _success =
            'Uploaded $_pages page${_pages == 1 ? '' : 's'} ($_pageBreakdown). Waiting for partner desktop.';
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
    final size = _selectedSize;

    return Scaffold(
      appBar: AppBar(
        title: Text(partner.companyName.isEmpty ? 'Partner' : partner.companyName),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: online
                      ? const Color(0xFFE8F5E9)
                      : const Color(0xFFF3F4F6),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  online ? 'Partner online' : 'Partner offline',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: online ? const Color(0xFF1B5E20) : AppColors.muted,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            online
                ? 'Upload a PDF and it will print on their desktop app.'
                : 'You can still upload. Printing starts when their desktop comes online.',
            style: const TextStyle(color: AppColors.muted, height: 1.4),
          ),
          const SizedBox(height: 24),
          const Text(
            '1. Document',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: AppColors.navy,
            ),
          ),
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
                                  ? 'Detecting each page (B&W vs color)…'
                                  : '$_pages page${_pages == 1 ? '' : 's'} · $_pageBreakdown',
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
                          onPressed: _submitting || _bwPages == _pages
                              ? null
                              : _forceAllBw,
                          child: const Text('All B&W'),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton(
                          onPressed: _submitting || _colorPages == _pages
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
          const Text(
            '2. Layout',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: AppColors.navy,
            ),
          ),
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
          const Text(
            '3. Copies',
            style: TextStyle(
              fontWeight: FontWeight.w800,
              fontSize: 16,
              color: AppColors.navy,
            ),
          ),
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
              children: [
                _PriceRow(label: 'Pages', value: '$_pages'),
                const SizedBox(height: 8),
                _PriceRow(label: 'B&W pages', value: '$_bwPages'),
                const SizedBox(height: 8),
                _PriceRow(label: 'Color pages', value: '$_colorPages'),
                const SizedBox(height: 8),
                _PriceRow(label: 'Copies', value: '$_copies'),
                if (size != null) ...[
                  const SizedBox(height: 8),
                  _PriceRow(
                    label: 'B&W / page',
                    value: '₱${_bwUnit.toStringAsFixed(2)}',
                  ),
                  const SizedBox(height: 8),
                  _PriceRow(
                    label: 'Color / page',
                    value: '₱${_colorUnit.toStringAsFixed(2)}',
                  ),
                ],
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
                const SizedBox(height: 4),
                Align(
                  alignment: Alignment.centerRight,
                  child: Text(
                    '($_bwPages × ₱${_bwUnit.toStringAsFixed(2)} + $_colorPages × ₱${_colorUnit.toStringAsFixed(2)}) × $_copies',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ),
              ],
            ),
          ),
          if (_error != null) ...[
            const SizedBox(height: 14),
            Text(_error!, style: const TextStyle(color: Color(0xFFB71C1C))),
          ],
          if (_success != null) ...[
            const SizedBox(height: 14),
            Text(_success!, style: const TextStyle(color: Color(0xFF1B5E20))),
          ],
          const SizedBox(height: 18),
          DecoratedBox(
            decoration: BoxDecoration(
              gradient: AppTheme.brandGradient,
              borderRadius: BorderRadius.circular(999),
            ),
            child: FilledButton(
              onPressed: _submitting || _readingPdf || _sizes.isEmpty
                  ? null
                  : _submit,
              style: FilledButton.styleFrom(
                backgroundColor: Colors.transparent,
                disabledBackgroundColor: Colors.transparent,
                shadowColor: Colors.transparent,
                foregroundColor: Colors.white,
              ),
              child: _submitting
                  ? const SizedBox(
                      width: 22,
                      height: 22,
                      child: CircularProgressIndicator(
                        strokeWidth: 2.4,
                        color: Colors.white,
                      ),
                    )
                  : const Text('Upload & send to print'),
            ),
          ),
        ],
      ),
    );
  }
}

class _PriceRow extends StatelessWidget {
  const _PriceRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Text(label, style: const TextStyle(color: AppColors.muted)),
        const Spacer(),
        Text(
          value,
          style: const TextStyle(
            fontWeight: FontWeight.w700,
            color: AppColors.navy,
          ),
        ),
      ],
    );
  }
}
