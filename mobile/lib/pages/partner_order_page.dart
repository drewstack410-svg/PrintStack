import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import '../components/buttons/gradient_button.dart';
import '../components/common/message_banner.dart';
import '../models/partner.dart';
import '../models/print_draft_document.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import '../utils/document_intake.dart';
import '../utils/pdf_pages.dart';
import 'print_queue_page.dart';

class PartnerOrderPage extends StatefulWidget {
  const PartnerOrderPage({
    super.key,
    required this.partner,
    this.returnDocumentOnly = false,
    this.initialDocumentPath,
    this.initialDocumentName,
    this.initialPaperSize,
  });

  final Partner partner;

  /// When true (opened from the print queue), Continue pops with the draft doc.
  final bool returnDocumentOnly;

  /// When set (e.g. after "Print at this shop" intake), open already on preview.
  final String? initialDocumentPath;
  final String? initialDocumentName;
  final PaperSize? initialPaperSize;

  @override
  State<PartnerOrderPage> createState() => _PartnerOrderPageState();
}

enum _PageInkFilter { all, bw, color }

class _PickedDocument {
  const _PickedDocument({required this.path, required this.name});

  final String path;
  final String name;
}

class _PartnerOrderPageState extends State<PartnerOrderPage> {
  _PickedDocument? _picked;
  PaperSize? _selectedSize;
  int _copies = 1;
  int _bwPages = 0;
  int _colorPages = 0;
  List<bool> _pageIsColor = const [];
  _PageInkFilter _pageFilter = _PageInkFilter.all;
  bool _readingPdf = false;
  bool _layoutFromPdf = false;
  bool _printColorAsBw = false;
  String? _error;
  String? _success;
  late final Stream<Partner?> _partnerStream;
  Partner? _livePartner;
  StreamSubscription<Partner?>? _partnerSub;

  @override
  void initState() {
    super.initState();
    _livePartner = widget.partner;
    _partnerStream = PartnersRepository.instance.watchPartner(
      widget.partner.id,
    );
    _partnerSub = _partnerStream.listen((partner) {
      if (!mounted) return;
      setState(() => _livePartner = partner ?? widget.partner);
    });

    final initialPath = widget.initialDocumentPath?.trim() ?? '';
    if (initialPath.isNotEmpty) {
      final name = (widget.initialDocumentName?.trim().isNotEmpty ?? false)
          ? widget.initialDocumentName!.trim()
          : initialPath.split(RegExp(r'[\\/]')).last;
      _picked = _PickedDocument(path: initialPath, name: name);
      _readingPdf = true;
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _loadDocument(_picked!, forcedSize: widget.initialPaperSize);
      });
    }
  }

  @override
  void dispose() {
    _partnerSub?.cancel();
    super.dispose();
  }

  bool get _shopOnline => _livePartner?.location?.online == true;

  List<PaperSize> get _sizes => widget.partner.paperSizes;

  int get _totalPages => _bwPages + _colorPages;

  double get _bwUnit => _selectedSize?.priceBw ?? 0;
  double get _colorUnit => _selectedSize?.priceColor ?? 0;

  int get _billedBwPages => _printColorAsBw ? _totalPages : _bwPages;
  int get _billedColorPages => _printColorAsBw ? 0 : _colorPages;

  double get _bwSubtotal => _billedBwPages * _copies * _bwUnit;
  double get _colorSubtotal => _billedColorPages * _copies * _colorUnit;
  double get _currentTotal => _bwSubtotal + _colorSubtotal;

  bool get _canContinue =>
      !_readingPdf &&
      _picked != null &&
      _picked!.path.isNotEmpty &&
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
    _printColorAsBw = false;
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

  Future<void> _chooseDocumentSource() async {
    if (_readingPdf) {
      return;
    }
    setState(() {
      _error = null;
      _success = null;
    });

    try {
      final picked = await intakePrintDocument(
        context,
        layouts: _sizes.isEmpty ? PaperSize.defaults : _sizes,
        initialLayout: _selectedSize,
      );
      if (!mounted || picked == null) {
        return;
      }
      if (picked.path.isEmpty) {
        setState(() => _error = 'Could not read that document.');
        return;
      }
      await _loadDocument(
        _PickedDocument(path: picked.path, name: picked.name),
        forcedSize: picked.paperSize,
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _readingPdf = false;
        _error = 'Could not add that document.';
      });
      debugPrint('Document intake failed: $error');
    }
  }

  Future<void> _loadDocument(
    _PickedDocument file, {
    PaperSize? forcedSize,
  }) async {
    setState(() {
      _picked = file;
      _readingPdf = true;
      _resetDetection();
    });

    final info = await analyzePdfSafe(file.path);
    if (!mounted) {
      return;
    }

    setState(() {
      _bwPages = info.bwPages;
      _colorPages = info.colorPages;
      _pageIsColor = info.pageIsColor;
      _pageFilter = _PageInkFilter.all;
      final matched = forcedSize ?? _matchPaperSize(info);
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
    if (!_canContinue || size == null || picked == null) {
      return null;
    }

    return PrintDraftDocument(
      path: picked.path,
      fileName: picked.name,
      paperSize: size,
      copies: _copies,
      bwPages: _bwPages,
      colorPages: _colorPages,
      pageIsColor: List<bool>.from(_pageIsColor),
      forceBlackAndWhite: _printColorAsBw && _colorPages > 0,
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
          partner: _livePartner ?? widget.partner,
          documents: [draft],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final partner = _livePartner ?? widget.partner;
    final online = _shopOnline;
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
          if (!online)
            const Padding(
              padding: EdgeInsets.fromLTRB(16, 10, 16, 0),
              child: MessageBanner(
                message:
                    'This shop is offline. Your print request will be reserved and queued.',
              ),
            ),
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
                          printColorAsBw: _printColorAsBw,
                          sizeName: _selectedSize?.name,
                          sizeLabel: _selectedSize?.sizeLabel,
                          sizeMatched: _layoutFromPdf,
                          onFilterBw: () =>
                              _togglePageFilter(_PageInkFilter.bw),
                          onFilterColor: () =>
                              _togglePageFilter(_PageInkFilter.color),
                          onChange: _readingPdf ? null : _chooseDocumentSource,
                          onClear: _readingPdf ? null : _clearDocument,
                        )
                      : Padding(
                          padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                          child: _ChooseDocumentButton(
                            busy: _readingPdf,
                            onTap: _readingPdf ? null : _chooseDocumentSource,
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
                padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (_picked != null) ...[
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 0,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.mist,
                          borderRadius: BorderRadius.circular(10),
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
                                fontSize: 12,
                                color: AppColors.navy,
                              ),
                            ),
                            const Spacer(),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                              padding: EdgeInsets.zero,
                              iconSize: 18,
                              onPressed: _copies <= 1
                                  ? null
                                  : () => setState(() => _copies -= 1),
                              icon: const Icon(Icons.remove_circle_outline),
                            ),
                            SizedBox(
                              width: 28,
                              child: Text(
                                '$_copies',
                                textAlign: TextAlign.center,
                                style: const TextStyle(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.navy,
                                ),
                              ),
                            ),
                            IconButton(
                              visualDensity: VisualDensity.compact,
                              constraints: const BoxConstraints(
                                minWidth: 32,
                                minHeight: 32,
                              ),
                              padding: EdgeInsets.zero,
                              iconSize: 18,
                              onPressed: _copies >= 50
                                  ? null
                                  : () => setState(() => _copies += 1),
                              icon: const Icon(Icons.add_circle_outline),
                            ),
                          ],
                        ),
                      ),
                      if (_colorPages > 0) ...[
                        const SizedBox(height: 6),
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 0,
                          ),
                          decoration: BoxDecoration(
                            color: AppColors.mist,
                            borderRadius: BorderRadius.circular(10),
                            border: Border.all(
                              color: AppColors.purple.withValues(alpha: 0.12),
                            ),
                          ),
                          child: SwitchListTile.adaptive(
                            contentPadding: EdgeInsets.zero,
                            dense: true,
                            visualDensity: VisualDensity.compact,
                            value: _printColorAsBw,
                            onChanged: (value) {
                              setState(() => _printColorAsBw = value);
                            },
                            title: const Text(
                              'Print color as B&W',
                              style: TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 12,
                                color: AppColors.navy,
                              ),
                            ),
                            subtitle: Text(
                              _printColorAsBw
                                  ? 'All $_totalPages pages billed at B&W price'
                                  : '$_colorPages color page${_colorPages == 1 ? '' : 's'} at color price',
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 10,
                              ),
                            ),
                          ),
                        ),
                      ],
                      const SizedBox(height: 6),
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
                                  fontSize: 10,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              Text(
                                '₱${_currentTotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 18,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.purple,
                                ),
                              ),
                            ],
                          ),
                        ),
                        SizedBox(
                          width: 120,
                          child: GradientButton(
                            label: !online
                                ? 'Reserve'
                                : widget.returnDocumentOnly
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

class _ChooseDocumentButton extends StatelessWidget {
  const _ChooseDocumentButton({required this.onTap, this.busy = false});

  final VoidCallback? onTap;
  final bool busy;

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
                child: busy
                    ? const Padding(
                        padding: EdgeInsets.all(18),
                        child: CircularProgressIndicator(
                          strokeWidth: 2.5,
                          color: Colors.white,
                        ),
                      )
                    : const Icon(
                        Icons.upload_file_rounded,
                        size: 28,
                        color: Colors.white,
                      ),
              ),
              const SizedBox(height: 14),
              const Text(
                'Choose document',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w900,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Tap to upload a PDF or scan a document',
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
    this.printColorAsBw = false,
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
  final bool printColorAsBw;
  final bool sizeMatched;
  final VoidCallback onFilterBw;
  final VoidCallback onFilterColor;
  final String? sizeName;
  final String? sizeLabel;
  final VoidCallback? onChange;
  final VoidCallback? onClear;

  static const _greyscaleFilter = ColorFilter.matrix(<double>[
    0.2126,
    0.7152,
    0.0722,
    0,
    0,
    0.2126,
    0.7152,
    0.0722,
    0,
    0,
    0.2126,
    0.7152,
    0.0722,
    0,
    0,
    0,
    0,
    0,
    1,
    0,
  ]);

  bool _pageVisible(int pageNumber) {
    if (printColorAsBw ||
        pageFilter == _PageInkFilter.all ||
        pageIsColor.isEmpty) {
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
        ? pages.fold<double>(0, (w, page) => math.max(w, page.width.toDouble()))
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
        layouts[i] = Rect.fromLTWH(-pageWidth - 64, 0, pageWidth, pageHeight);
      }
    }

    return PdfPageLayout(
      pageLayouts: layouts,
      documentSize: Size(width, math.max(y, 1.0)),
    );
  }

  @override
  Widget build(BuildContext context) {
    final effectiveFilter = printColorAsBw ? _PageInkFilter.all : pageFilter;
    final previewBwPages = printColorAsBw ? bwPages + colorPages : bwPages;
    final previewColorPages = printColorAsBw ? 0 : colorPages;
    final hasFilteredPages =
        effectiveFilter == _PageInkFilter.all ||
        _filteredCount > 0 ||
        pageIsColor.isEmpty;

    final viewer = hasFilteredPages
        ? PdfViewer.file(
            path,
            key: ValueKey(
              'preview-$path-$effectiveFilter-$_firstVisiblePageNumber-$printColorAsBw',
            ),
            initialPageNumber: _firstVisiblePageNumber,
            params: PdfViewerParams(
              margin: 0,
              backgroundColor: const Color(0xFFE8ECF4),
              layoutPages: effectiveFilter == _PageInkFilter.all
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
          );

    return Stack(
      children: [
        Positioned.fill(
          child: ColoredBox(
            color: const Color(0xFFE8ECF4),
            child: printColorAsBw
                ? ColorFiltered(colorFilter: _greyscaleFilter, child: viewer)
                : viewer,
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
          left: 10,
          top: 10,
          right: 10,
          child: Row(
            children: [
              Flexible(
                child: Material(
                  color: Colors.white.withValues(alpha: 0.94),
                  borderRadius: BorderRadius.circular(999),
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 7,
                      vertical: 4,
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.crop_free,
                          size: 11,
                          color: sizeMatched
                              ? AppColors.purple
                              : AppColors.muted,
                        ),
                        const SizedBox(width: 3),
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
                              fontSize: 9,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              if (printColorAsBw) ...[
                const SizedBox(width: 6),
                Material(
                  color: AppColors.navy.withValues(alpha: 0.92),
                  borderRadius: BorderRadius.circular(999),
                  elevation: 2,
                  child: const Padding(
                    padding: EdgeInsets.symmetric(horizontal: 8, vertical: 5),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          Icons.filter_b_and_w,
                          size: 12,
                          color: Colors.white,
                        ),
                        SizedBox(width: 4),
                        Text(
                          'B&W',
                          style: TextStyle(
                            color: Colors.white,
                            fontWeight: FontWeight.w800,
                            fontSize: 10,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
              const SizedBox(width: 6),
              Material(
                color: Colors.white.withValues(alpha: 0.94),
                borderRadius: BorderRadius.circular(999),
                elevation: 2,
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      tooltip: 'Change',
                      visualDensity: VisualDensity.compact,
                      constraints: const BoxConstraints(
                        minWidth: 26,
                        minHeight: 26,
                      ),
                      padding: EdgeInsets.zero,
                      iconSize: 16,
                      onPressed: onChange,
                      icon: const Icon(Icons.swap_horiz),
                    ),
                    IconButton(
                      tooltip: 'Remove',
                      visualDensity: VisualDensity.compact,
                      constraints: const BoxConstraints(
                        minWidth: 26,
                        minHeight: 26,
                      ),
                      padding: EdgeInsets.zero,
                      iconSize: 16,
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
            right: 10,
            bottom: 10,
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                _CountBadgeIcon(
                  icon: Icons.filter_b_and_w,
                  count: previewBwPages,
                  color: AppColors.navy,
                  selected: !printColorAsBw && pageFilter == _PageInkFilter.bw,
                  tooltip: printColorAsBw
                      ? 'Showing all pages as B&W'
                      : pageFilter == _PageInkFilter.bw
                      ? 'Show all pages'
                      : 'Show B&W pages only',
                  onTap: printColorAsBw || previewBwPages <= 0
                      ? null
                      : onFilterBw,
                ),
                const SizedBox(height: 6),
                _CountBadgeIcon(
                  icon: Icons.palette_outlined,
                  count: previewColorPages,
                  color: AppColors.purple,
                  selected:
                      !printColorAsBw && pageFilter == _PageInkFilter.color,
                  tooltip: printColorAsBw
                      ? 'Color preview disabled'
                      : pageFilter == _PageInkFilter.color
                      ? 'Show all pages'
                      : 'Show color pages only',
                  onTap: printColorAsBw || previewColorPages <= 0
                      ? null
                      : onFilterColor,
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
                  fontSize: 9,
                  fontWeight: FontWeight.w800,
                ),
              ),
              backgroundColor: color,
              child: SizedBox(
                width: 34,
                height: 34,
                child: Icon(icon, size: 18, color: color),
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
