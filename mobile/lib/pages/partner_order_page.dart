import 'dart:math' as math;

import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import '../components/buttons/gradient_button.dart';
import '../components/common/message_banner.dart';
import '../models/partner.dart';
import '../models/print_draft_document.dart';
import '../theme.dart';
import '../utils/pdf_pages.dart';
import 'print_queue_page.dart';

class PartnerOrderPage extends StatefulWidget {
  const PartnerOrderPage({
    super.key,
    required this.partner,
    this.returnDocumentOnly = false,
  });

  final Partner partner;

  /// When true (opened from the print queue), Continue pops with the draft doc.
  final bool returnDocumentOnly;

  @override
  State<PartnerOrderPage> createState() => _PartnerOrderPageState();
}

enum _PageInkFilter { all, bw, color }

class _PartnerOrderPageState extends State<PartnerOrderPage> {
  PlatformFile? _picked;
  PaperSize? _selectedSize;
  int _copies = 1;
  int _bwPages = 0;
  int _colorPages = 0;
  List<bool> _pageIsColor = const [];
  _PageInkFilter _pageFilter = _PageInkFilter.all;
  bool _layoutFromPdf = false;
  bool _readingPdf = false;
  String? _error;
  String? _success;

  List<PaperSize> get _sizes => widget.partner.paperSizes;

  int get _totalPages => _bwPages + _colorPages;

  double get _bwUnit => _selectedSize?.priceBw ?? 0;
  double get _colorUnit => _selectedSize?.priceColor ?? 0;

  double get _bwSubtotal => _bwPages * _copies * _bwUnit;
  double get _colorSubtotal => _colorPages * _copies * _colorUnit;
  double get _currentTotal => _bwSubtotal + _colorSubtotal;

  bool get _canContinue =>
      !_readingPdf &&
      _picked != null &&
      (_picked!.path ?? '').isNotEmpty &&
      _layoutFromPdf &&
      _selectedSize != null &&
      _totalPages > 0 &&
      _sizes.isNotEmpty;

  void _resetDetection() {
    _bwPages = 0;
    _colorPages = 0;
    _pageIsColor = const [];
    _pageFilter = _PageInkFilter.all;
    _layoutFromPdf = false;
    _selectedSize = null;
  }

  void _togglePageFilter(_PageInkFilter filter) {
    setState(() {
      _pageFilter = _pageFilter == filter ? _PageInkFilter.all : filter;
    });
  }

  double _toMm(PaperSize size, double value) {
    return size.unit == 'in' ? value * 25.4 : value;
  }

  PaperSize? _matchPaperSize(PdfDocumentInfo info) {
    if (_sizes.isEmpty) {
      return null;
    }
    if (info.pageWidthPt <= 0 || info.pageHeightPt <= 0) {
      return null;
    }

    final pdfW = math.min(info.pageWidthMm, info.pageHeightMm);
    final pdfH = math.max(info.pageWidthMm, info.pageHeightMm);

    PaperSize? best;
    var bestScore = double.infinity;

    for (final size in _sizes) {
      final sizeWMm = _toMm(size, size.width);
      final sizeHMm = _toMm(size, size.height);
      final w = math.min(sizeWMm, sizeHMm);
      final h = math.max(sizeWMm, sizeHMm);
      if (w <= 0 || h <= 0) {
        continue;
      }

      final score = (pdfW - w).abs() + (pdfH - h).abs();
      if (score < bestScore) {
        bestScore = score;
        best = size;
      }
    }

    if (best == null || bestScore > 12) {
      return null;
    }
    return best;
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
      _pageIsColor = info.pageIsColor;
      _pageFilter = _PageInkFilter.all;
      final matched = _matchPaperSize(info);
      _selectedSize = matched;
      _layoutFromPdf = matched != null;
      if (matched == null && _sizes.isNotEmpty) {
        _error =
            'Could not match PDF page size to this shop’s layouts. Ask the shop to add this paper size.';
      }
      _readingPdf = false;
    });
  }

  void _clearDocument() {
    setState(() {
      _picked = null;
      _copies = 1;
      _resetDetection();
      _error = null;
    });
  }

  PrintDraftDocument? _buildCurrentDraft() {
    final size = _selectedSize;
    final picked = _picked;
    final path = picked?.path;
    if (!_canContinue || size == null || picked == null || path == null) {
      return null;
    }

    return PrintDraftDocument(
      path: path,
      fileName: picked.name,
      paperSize: size,
      copies: _copies,
      bwPages: _bwPages,
      colorPages: _colorPages,
      pageIsColor: List<bool>.from(_pageIsColor),
    );
  }

  void _continueToQueue() {
    final draft = _buildCurrentDraft();
    if (draft == null) {
      setState(() => _error = 'Choose a document first.');
      return;
    }

    setState(() {
      _error = null;
      _success = null;
    });

    if (widget.returnDocumentOnly) {
      Navigator.of(context).pop(draft);
      return;
    }

    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(
        builder: (_) => PrintQueuePage(
          partner: widget.partner,
          documents: [draft],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final partner = widget.partner;
    final online = partner.location?.online == true;
    final path = _picked?.path;
    final showPreview = path != null && path.isNotEmpty;

    return Scaffold(
      backgroundColor: AppColors.mist,
      appBar: AppBar(
        title: Text(partner.companyName.isEmpty ? 'Shop' : partner.companyName),
        actions: [
          Padding(
            padding: const EdgeInsets.only(right: 16),
            child: Center(child: _StatusGlowLight(online: online)),
          ),
        ],
      ),
      body: Column(
        children: [
          Expanded(
            child: Stack(
              children: [
                Positioned.fill(
                  child: showPreview
                      ? _DocumentPreview(
                          path: path,
                          reading: _readingPdf,
                          bwPages: _bwPages,
                          colorPages: _colorPages,
                          pageIsColor: _pageIsColor,
                          pageFilter: _pageFilter,
                          sizeName: _selectedSize?.name,
                          sizeLabel: _selectedSize?.sizeLabel,
                          sizeMatched: _layoutFromPdf,
                          onFilterBw: () => _togglePageFilter(_PageInkFilter.bw),
                          onFilterColor: () =>
                              _togglePageFilter(_PageInkFilter.color),
                          onChange: _readingPdf ? null : _pickPdf,
                          onClear: _readingPdf ? null : _clearDocument,
                        )
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: _BigUploadButton(
                            busy: _readingPdf,
                            label: 'Choose document',
                            onTap: _readingPdf ? null : _pickPdf,
                          ),
                        ),
                ),
                if (_error != null)
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 12,
                    child: MessageBanner(message: _error!, isError: true),
                  ),
                if (_success != null)
                  Positioned(
                    left: 20,
                    right: 20,
                    bottom: 12,
                    child: MessageBanner(message: _success!),
                  ),
              ],
            ),
          ),
          Material(
            elevation: 12,
            color: Colors.white,
            shadowColor: Colors.black38,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_picked != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.mist,
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: AppColors.purple.withValues(alpha: 0.12),
                          ),
                        ),
                        child: Row(
                          children: [
                            const Text(
                              'Copies',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 14,
                                color: AppColors.navy,
                              ),
                            ),
                            const Spacer(),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: _copies <= 1
                                  ? null
                                  : () => setState(() => _copies -= 1),
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                            SizedBox(
                              width: 36,
                              child: Text(
                                '$_copies',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.navy,
                                ),
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              onPressed: _copies >= 50
                                  ? null
                                  : () => setState(() => _copies += 1),
                              icon: const Icon(Icons.add_circle_outline),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: 10),
                    ],
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Text(
                                'Estimated total',
                                style: TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '₱${_currentTotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.purple,
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(
                          width: 148,
                          child: GradientButton(
                            label: widget.returnDocumentOnly
                                ? 'Add to list'
                                : 'Continue',
                            onPressed: _canContinue ? _continueToQueue : null,
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BigUploadButton extends StatelessWidget {
  const _BigUploadButton({
    required this.onTap,
    this.busy = false,
    this.label = 'Choose document',
  });

  final VoidCallback? onTap;
  final bool busy;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(28),
      elevation: 2,
      shadowColor: Colors.black26,
      child: InkWell(
        borderRadius: BorderRadius.circular(28),
        onTap: onTap,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            border: Border.all(
              color: AppColors.purple.withValues(alpha: 0.28),
              width: 2,
            ),
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Container(
                width: 108,
                height: 108,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AppTheme.brandGradient,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.purple.withValues(alpha: 0.28),
                      blurRadius: 24,
                      offset: const Offset(0, 10),
                    ),
                  ],
                ),
                child: busy
                    ? const Padding(
                        padding: EdgeInsets.all(34),
                        child: CircularProgressIndicator(
                          strokeWidth: 3,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.upload_file_rounded,
                        size: 48,
                        color: Colors.white,
                      ),
              ),
              const SizedBox(height: 28),
              Text(
                label,
                style: const TextStyle(
                  fontSize: 26,
                  fontWeight: FontWeight.w900,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'Tap to select a PDF file',
                style: TextStyle(
                  fontSize: 15,
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

class _DocumentPreview extends StatelessWidget {
  const _DocumentPreview({
    required this.path,
    required this.reading,
    required this.bwPages,
    required this.colorPages,
    required this.pageIsColor,
    required this.pageFilter,
    required this.sizeMatched,
    required this.onFilterBw,
    required this.onFilterColor,
    this.sizeName,
    this.sizeLabel,
    this.onChange,
    this.onClear,
  });

  final String path;
  final bool reading;
  final int bwPages;
  final int colorPages;
  final List<bool> pageIsColor;
  final _PageInkFilter pageFilter;
  final bool sizeMatched;
  final VoidCallback onFilterBw;
  final VoidCallback onFilterColor;
  final String? sizeName;
  final String? sizeLabel;
  final VoidCallback? onChange;
  final VoidCallback? onClear;

  bool _pageVisible(int pageNumber) {
    if (pageFilter == _PageInkFilter.all || pageIsColor.isEmpty) {
      return true;
    }
    final index = pageNumber - 1;
    if (index < 0 || index >= pageIsColor.length) {
      return true; // keep page visible if classification is missing
    }
    final isColor = pageIsColor[index];
    return pageFilter == _PageInkFilter.color ? isColor : !isColor;
  }

  int get _firstVisiblePageNumber {
    for (var i = 0; i < pageIsColor.length; i++) {
      if (_pageVisible(i + 1)) {
        return i + 1;
      }
    }
    return 1;
  }

  int get _filteredCount {
    if (pageFilter == _PageInkFilter.bw) {
      return bwPages;
    }
    if (pageFilter == _PageInkFilter.color) {
      return colorPages;
    }
    return bwPages + colorPages;
  }

  PdfPageLayout _layoutFilteredPages(
    List<PdfPage> pages,
    PdfViewerParams params,
  ) {
    // Always keep non-zero rects. Hidden pages are parked off-screen so the
    // viewer does not blank when the first document page is filtered out.
    final visiblePages = [
      for (final page in pages)
        if (_pageVisible(page.pageNumber)) page,
    ];

    final contentWidth = visiblePages.isEmpty
        ? pages.fold<double>(
            0,
            (w, page) => math.max(w, page.width.toDouble()),
          )
        : visiblePages.fold<double>(
            0,
            (w, page) => math.max(w, page.width.toDouble()),
          );
    final width = math.max(contentWidth, 1.0);

    final layouts = List<Rect>.filled(
      pages.length,
      const Rect.fromLTWH(-1, -1, 1, 1),
    );
    var y = 0.0;

    for (var i = 0; i < pages.length; i++) {
      final page = pages[i];
      final pageWidth = math.max(page.width.toDouble(), 1.0);
      final pageHeight = math.max(page.height.toDouble(), 1.0);

      if (_pageVisible(page.pageNumber) && visiblePages.isNotEmpty) {
        layouts[i] = Rect.fromLTWH(
          (width - pageWidth) / 2,
          y,
          pageWidth,
          pageHeight,
        );
        y += pageHeight;
      } else {
        // Park filtered-out pages left of the viewport (still valid size).
        layouts[i] = Rect.fromLTWH(
          -pageWidth - 64,
          0,
          pageWidth,
          pageHeight,
        );
      }
    }

    return PdfPageLayout(
      pageLayouts: layouts,
      documentSize: Size(width, math.max(y, 1.0)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final hasFilteredPages = pageFilter == _PageInkFilter.all ||
        _filteredCount > 0 ||
        pageIsColor.isEmpty;

    return Stack(
      children: [
        Positioned.fill(
          child: ColoredBox(
            color: const Color(0xFFE8ECF4),
            child: hasFilteredPages
                ? PdfViewer.file(
                    path,
                    key: ValueKey(
                      'preview-$path-$pageFilter-$_firstVisiblePageNumber',
                    ),
                    initialPageNumber: _firstVisiblePageNumber,
                    params: PdfViewerParams(
                      margin: 0,
                      backgroundColor: const Color(0xFFE8ECF4),
                      layoutPages: pageFilter == _PageInkFilter.all
                          ? null
                          : _layoutFilteredPages,
                    ),
                  )
                : Center(
                    child: Text(
                      pageFilter == _PageInkFilter.color
                          ? 'No color pages detected'
                          : 'No B&W pages detected',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ),
          ),
        ),
        if (reading)
          const Positioned.fill(
            child: ColoredBox(
              color: Color(0x66FFFFFF),
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
        Positioned(
          left: 12,
          top: 12,
          right: 12,
          child: Row(
            children: [
              Flexible(
                child: Material(
                  color: Colors.white.withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(999),
                  elevation: 3,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 8,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.crop_free,
                          size: 16,
                          color: sizeMatched
                              ? AppColors.purple
                              : AppColors.muted,
                        ),
                        const SizedBox(width: 6),
                        Flexible(
                          child: Text(
                            sizeMatched && sizeName != null
                                ? '$sizeName · ${sizeLabel ?? ''}'
                                : 'Size not matched',
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w800,
                              color: AppColors.navy,
                              fontSize: 12,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 8),
              Material(
                color: Colors.white.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(999),
                elevation: 3,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Change',
                      onPressed: onChange,
                      icon: const Icon(Icons.swap_horiz),
                    ),
                    IconButton(
                      tooltip: 'Remove',
                      onPressed: onClear,
                      icon: const Icon(Icons.close),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
        if (!reading)
          Positioned(
            right: 14,
            bottom: 14,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _CountBadgeIcon(
                  icon: Icons.filter_b_and_w,
                  count: bwPages,
                  color: AppColors.navy,
                  selected: pageFilter == _PageInkFilter.bw,
                  tooltip: pageFilter == _PageInkFilter.bw
                      ? 'Show all pages'
                      : 'Show B&W pages only',
                  onTap: bwPages > 0 ? onFilterBw : null,
                ),
                const SizedBox(height: 10),
                _CountBadgeIcon(
                  icon: Icons.palette_outlined,
                  count: colorPages,
                  color: AppColors.purple,
                  selected: pageFilter == _PageInkFilter.color,
                  tooltip: pageFilter == _PageInkFilter.color
                      ? 'Show all pages'
                      : 'Show color pages only',
                  onTap: colorPages > 0 ? onFilterColor : null,
                ),
              ],
            ),
          ),
      ],
    );
  }
}

class _CountBadgeIcon extends StatelessWidget {
  const _CountBadgeIcon({
    required this.icon,
    required this.count,
    required this.color,
    required this.tooltip,
    required this.onTap,
    this.selected = false,
  });

  final IconData icon;
  final int count;
  final Color color;
  final String tooltip;
  final VoidCallback? onTap;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: selected ? color.withValues(alpha: 0.12) : Colors.white,
        elevation: selected ? 8 : 6,
        shadowColor: Colors.black38,
        shape: CircleBorder(
          side: BorderSide(
            color: selected ? color : Colors.transparent,
            width: 2,
          ),
        ),
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Opacity(
            opacity: onTap == null ? 0.45 : 1,
            child: Badge(
              isLabelVisible: true,
              label: Text(
                '$count',
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
              backgroundColor: color,
              child: SizedBox(
                width: 46,
                height: 46,
                child: Icon(icon, color: color),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _StatusGlowLight extends StatefulWidget {
  const _StatusGlowLight({required this.online});

  final bool online;

  @override
  State<_StatusGlowLight> createState() => _StatusGlowLightState();
}

class _StatusGlowLightState extends State<_StatusGlowLight>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.online) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant _StatusGlowLight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.online && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.online && _controller.isAnimating) {
      _controller
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.online) {
      return Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: 0.28),
        ),
      );
    }

    return SizedBox(
      width: 18,
      height: 18,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final t = _controller.value;
          final pulse = 1 - t;
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 16 * (0.5 + t * 0.85),
                height: 16 * (0.5 + t * 0.85),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22C55E).withValues(alpha: 0.4 * pulse),
                ),
              ),
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF4ADE80),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.95),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
