import 'dart:io';

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../models/partner.dart';
import '../theme.dart';

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
  bool _submitting = false;
  String? _error;
  String? _success;

  List<PaperSize> get _sizes => widget.partner.paperSizes;

  double get _total {
    final size = _selectedSize;
    if (size == null) {
      return 0;
    }
    return size.pricePerPiece * _copies;
  }

  @override
  void initState() {
    super.initState();
    if (_sizes.isNotEmpty) {
      _selectedSize = _sizes.first;
    }
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

    setState(() => _picked = file);
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
      );

      if (!mounted) {
        return;
      }

      setState(() {
        _success =
            'Uploaded. The partner desktop app will print it when online.';
        _picked = null;
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
      appBar: AppBar(title: Text(partner.companyName.isEmpty ? 'Partner' : partner.companyName)),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                decoration: BoxDecoration(
                  color: online ? const Color(0xFFE8F5E9) : const Color(0xFFF3F4F6),
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
              onTap: _submitting ? null : _pickPdf,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Icon(Icons.picture_as_pdf_outlined, color: AppColors.purple),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        _picked?.name ?? 'Choose PDF',
                        style: TextStyle(
                          fontWeight: FontWeight.w700,
                          color: _picked == null ? AppColors.muted : AppColors.navy,
                        ),
                      ),
                    ),
                    const Icon(Icons.upload_file, color: AppColors.muted),
                  ],
                ),
              ),
            ),
          ),
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
            ..._sizes.map((size) {
              final selected = _selectedSize?.id == size.id;
              return Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(16),
                    onTap: _submitting
                        ? null
                        : () => setState(() => _selectedSize = size),
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
                            color: selected ? AppColors.purple : AppColors.muted,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  size.name,
                                  style: const TextStyle(
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.navy,
                                  ),
                                ),
                                const SizedBox(height: 2),
                                Text(
                                  size.sizeLabel,
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontSize: 13,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Text(
                            '₱${size.pricePerPiece.toStringAsFixed(2)}',
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
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
            child: Row(
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
              onPressed: _submitting || _sizes.isEmpty ? null : _submit,
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
