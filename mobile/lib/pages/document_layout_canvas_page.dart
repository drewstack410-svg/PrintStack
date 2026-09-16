import 'dart:io';
import 'dart:math' as math;
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';
import 'package:path_provider/path_provider.dart';
import 'package:pdf/pdf.dart';
import 'package:pdf/widgets.dart' as pw;

import '../models/partner.dart';
import '../theme.dart';

class DocumentLayoutResult {
  const DocumentLayoutResult({
    required this.pdfPath,
    required this.fileName,
    required this.paperSize,
  });

  final String pdfPath;
  final String fileName;
  final PaperSize paperSize;
}

/// Place a scanned photo onto a chosen paper layout with pan, scale, rotate.
class DocumentLayoutCanvasPage extends StatefulWidget {
  const DocumentLayoutCanvasPage({
    super.key,
    required this.imagePath,
    required this.layouts,
    this.initialLayout,
  });

  final String imagePath;
  final List<PaperSize> layouts;
  final PaperSize? initialLayout;

  @override
  State<DocumentLayoutCanvasPage> createState() =>
      _DocumentLayoutCanvasPageState();
}

class _DocumentLayoutCanvasPageState extends State<DocumentLayoutCanvasPage> {
  final _canvasKey = GlobalKey();
  late final TextEditingController _titleController;

  late PaperSize _layout;
  double _scale = 1;
  double _rotation = 0; // radians
  Offset _offset = Offset.zero;
  Offset? _lastFocal;
  double _startScale = 1;
  bool _exporting = false;
  String? _titleError;

  bool _guidesEnabled = true;
  bool _snapEnabled = true;
  bool _snappedX = false;
  bool _snappedY = false;
  bool _snappedRotation = false;

  static const _snapPx = 12.0;
  static const _snapRadians = 0.08; // ~4.5°

  @override
  void initState() {
    super.initState();
    _layout = widget.initialLayout ??
        (widget.layouts.isNotEmpty ? widget.layouts.first : PaperSize.defaults.first);
    _titleController = TextEditingController(text: 'Scanned document');
  }

  @override
  void dispose() {
    _titleController.dispose();
    super.dispose();
  }

  double get _paperAspect {
    final w = _layout.width <= 0 ? 1.0 : _layout.width;
    final h = _layout.height <= 0 ? 1.0 : _layout.height;
    return w / h;
  }

  void _resetTransform() {
    setState(() {
      _scale = 1;
      _rotation = 0;
      _offset = Offset.zero;
      _snappedX = true;
      _snappedY = true;
      _snappedRotation = true;
    });
  }

  void _centerImage() {
    setState(() {
      _offset = Offset.zero;
      _snappedX = true;
      _snappedY = true;
    });
  }

  double _normalizeRotation(double radians) {
    var value = radians;
    while (value > math.pi) {
      value -= math.pi * 2;
    }
    while (value < -math.pi) {
      value += math.pi * 2;
    }
    return value;
  }

  double _snapRotation(double radians) {
    final candidates = <double>[
      0,
      math.pi / 2,
      -math.pi / 2,
      math.pi,
      -math.pi,
    ];
    final normalized = _normalizeRotation(radians);
    for (final target in candidates) {
      if ((normalized - target).abs() <= _snapRadians) {
        _snappedRotation = true;
        return target == -math.pi ? math.pi : target;
      }
    }
    _snappedRotation = false;
    return normalized;
  }

  Offset _snapOffset(Offset next) {
    var dx = next.dx;
    var dy = next.dy;
    _snappedX = false;
    _snappedY = false;
    if (!_snapEnabled) {
      return next;
    }
    if (dx.abs() <= _snapPx) {
      dx = 0;
      _snappedX = true;
    }
    if (dy.abs() <= _snapPx) {
      dy = 0;
      _snappedY = true;
    }
    return Offset(dx, dy);
  }

  void _rotateBy(double deltaRadians) {
    setState(() {
      final next = _normalizeRotation(_rotation + deltaRadians);
      _rotation = _snapEnabled ? _snapRotation(next) : next;
    });
  }

  void _onScaleUpdate(ScaleUpdateDetails details) {
    setState(() {
      final nextScale = (_startScale * details.scale).clamp(0.35, 6.0);
      final focal = details.localFocalPoint;
      final last = _lastFocal ?? focal;
      final delta = focal - last;
      final rawOffset = _offset + delta;
      _offset = _snapOffset(rawOffset);
      _scale = nextScale;
      _lastFocal = focal;
    });
  }

  void _setRotation(double value) {
    setState(() {
      _rotation = _snapEnabled ? _snapRotation(value) : _normalizeRotation(value);
    });
  }

  PdfPageFormat get _pdfPageFormat {
    final w = _layout.unit == 'mm'
        ? _layout.width * PdfPageFormat.mm
        : _layout.width * PdfPageFormat.inch;
    final h = _layout.unit == 'mm'
        ? _layout.height * PdfPageFormat.mm
        : _layout.height * PdfPageFormat.inch;
    return PdfPageFormat(w, h);
  }

  String _safeFileName(String title) {
    final cleaned = title
        .trim()
        .replaceAll(RegExp(r'[^\w.\- ]+', unicode: true), '_')
        .replaceAll(RegExp(r'\s+'), ' ')
        .trim();
    final base = cleaned.isEmpty ? 'scanned-document' : cleaned;
    return base.toLowerCase().endsWith('.pdf') ? base : '$base.pdf';
  }

  Future<void> _apply() async {
    if (_exporting) {
      return;
    }
    final title = _titleController.text.trim();
    if (title.isEmpty) {
      setState(() => _titleError = 'Enter a file title');
      return;
    }

    setState(() {
      _titleError = null;
      _exporting = true;
    });
    try {
      final boundary =
          _canvasKey.currentContext?.findRenderObject() as RenderRepaintBoundary?;
      if (boundary == null) {
        throw StateError('Canvas is not ready');
      }

      final image = await boundary.toImage(pixelRatio: 3);
      final byteData = await image.toByteData(format: ui.ImageByteFormat.png);
      image.dispose();
      if (byteData == null) {
        throw StateError('Could not capture canvas');
      }
      final pngBytes = byteData.buffer.asUint8List();

      final doc = pw.Document();
      final pdfImage = pw.MemoryImage(pngBytes);
      doc.addPage(
        pw.Page(
          pageFormat: _pdfPageFormat,
          margin: pw.EdgeInsets.zero,
          build: (context) => pw.SizedBox.expand(
            child: pw.Image(pdfImage, fit: pw.BoxFit.cover),
          ),
        ),
      );

      final dir = await getTemporaryDirectory();
      final fileName = _safeFileName(title);
      final out = File(
        '${dir.path}/layout_${DateTime.now().millisecondsSinceEpoch}.pdf',
      );
      await out.writeAsBytes(await doc.save());

      if (!mounted) {
        return;
      }
      Navigator.of(context).pop(
        DocumentLayoutResult(
          pdfPath: out.path,
          fileName: fileName,
          paperSize: _layout,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Could not apply layout: $error')),
      );
    } finally {
      if (mounted) {
        setState(() => _exporting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final layouts = widget.layouts.isEmpty ? PaperSize.defaults : widget.layouts;

    return Scaffold(
      backgroundColor: AppColors.mist,
      appBar: AppBar(
        title: const Text('Place on layout'),
        actions: [
          TextButton(
            onPressed: _exporting ? null : _resetTransform,
            child: const Text('Reset'),
          ),
        ],
      ),
      body: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 8),
            child: Column(
              children: [
                TextField(
                  controller: _titleController,
                  enabled: !_exporting,
                  textCapitalization: TextCapitalization.sentences,
                  textInputAction: TextInputAction.next,
                  decoration: InputDecoration(
                    labelText: 'File title',
                    hintText: 'e.g. School form',
                    isDense: true,
                    errorText: _titleError,
                  ),
                  onChanged: (_) {
                    if (_titleError != null) {
                      setState(() => _titleError = null);
                    }
                  },
                ),
                const SizedBox(height: 10),
                DropdownButtonFormField<String>(
                  initialValue: layouts.any((s) => s.id == _layout.id)
                      ? _layout.id
                      : layouts.first.id,
                  key: ValueKey(_layout.id),
                  decoration: const InputDecoration(
                    labelText: 'Paper layout',
                    isDense: true,
                  ),
                  items: [
                    for (final size in layouts)
                      DropdownMenuItem(
                        value: size.id,
                        child: Text('${size.name} · ${size.sizeLabel}'),
                      ),
                  ],
                  onChanged: _exporting
                      ? null
                      : (id) {
                          if (id == null) {
                            return;
                          }
                          final next = layouts.firstWhere((s) => s.id == id);
                          setState(() {
                            _layout = next;
                            _scale = 1;
                            _rotation = 0;
                            _offset = Offset.zero;
                          });
                        },
                ),
              ],
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 4, 16, 8),
              child: Center(
                child: AspectRatio(
                  aspectRatio: _paperAspect,
                  child: DecoratedBox(
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(8),
                      boxShadow: const [
                        BoxShadow(
                          color: Colors.black26,
                          blurRadius: 12,
                          offset: Offset(0, 4),
                        ),
                      ],
                      border: Border.all(
                        color: AppColors.purple.withValues(alpha: 0.25),
                      ),
                    ),
                    child: ClipRRect(
                      borderRadius: BorderRadius.circular(7),
                      child: LayoutBuilder(
                        builder: (context, constraints) {
                          return GestureDetector(
                            onScaleStart: (details) {
                              _lastFocal = details.localFocalPoint;
                              _startScale = _scale;
                            },
                            onScaleUpdate: (details) {
                              setState(() {
                                final nextScale =
                                    (_startScale * details.scale).clamp(0.35, 6.0);
                                final focal = details.localFocalPoint;
                                final last = _lastFocal ?? focal;
                                final delta = focal - last;
                                _offset += delta;
                                _scale = nextScale;
                                _lastFocal = focal;
                              });
                            },
                            onScaleEnd: (_) => _lastFocal = null,
                            child: ColoredBox(
                              color: const Color(0xFFE8ECF4),
                              child: RepaintBoundary(
                                key: _canvasKey,
                                child: ColoredBox(
                                  color: Colors.white,
                                  child: ClipRect(
                                    child: Center(
                                      child: Transform.translate(
                                        offset: _offset,
                                        child: Transform.rotate(
                                          angle: _rotation,
                                          child: Transform.scale(
                                            scale: _scale,
                                            child: Image.file(
                                              File(widget.imagePath),
                                              fit: BoxFit.contain,
                                              width: constraints.maxWidth,
                                              height: constraints.maxHeight,
                                              errorBuilder: (_, error, stack) =>
                                                  const Icon(
                                                Icons.broken_image_outlined,
                                                size: 48,
                                                color: AppColors.muted,
                                              ),
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                  ),
                ),
              ),
            ),
          ),
          Material(
            color: Colors.white,
            elevation: 8,
            child: SafeArea(
              top: false,
              child: Padding(
                padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Row(
                      children: [
                        IconButton(
                          tooltip: 'Rotate left',
                          onPressed: _exporting
                              ? null
                              : () => _rotateBy(-math.pi / 2),
                          icon: const Icon(Icons.rotate_90_degrees_ccw),
                        ),
                        IconButton(
                          tooltip: 'Rotate right',
                          onPressed: _exporting
                              ? null
                              : () => _rotateBy(math.pi / 2),
                          icon: const Icon(Icons.rotate_90_degrees_cw),
                        ),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              const Text(
                                'Rotate',
                                style: TextStyle(
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.muted,
                                ),
                              ),
                              Slider(
                                value: _rotation,
                                min: -math.pi,
                                max: math.pi,
                                onChanged: _exporting
                                    ? null
                                    : (value) =>
                                        setState(() => _rotation = value),
                              ),
                            ],
                          ),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        const Icon(Icons.zoom_in, size: 18, color: AppColors.muted),
                        Expanded(
                          child: Slider(
                            value: _scale,
                            min: 0.35,
                            max: 6,
                            onChanged: _exporting
                                ? null
                                : (value) => setState(() => _scale = value),
                          ),
                        ),
                        Text(
                          '${_scale.toStringAsFixed(1)}×',
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Pinch to scale · drag to move · paper edge crops the print',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 11,
                        color: AppColors.muted,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 10),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: _exporting ? null : _apply,
                        style: FilledButton.styleFrom(
                          backgroundColor: AppColors.purple,
                          minimumSize: const Size.fromHeight(48),
                        ),
                        child: _exporting
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2.4,
                                  color: Colors.white,
                                ),
                              )
                            : const Text('Apply to preview'),
                      ),
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
