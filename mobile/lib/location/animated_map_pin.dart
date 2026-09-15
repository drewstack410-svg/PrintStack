import 'package:flutter/material.dart';

import '../theme.dart';

/// Map pin that lifts while the map is dragged, then drops with a bounce.
class AnimatedMapPin extends StatelessWidget {
  const AnimatedMapPin({
    super.key,
    required this.dragging,
  });

  final bool dragging;

  @override
  Widget build(BuildContext context) {
    return IgnorePointer(
      child: AnimatedSlide(
        duration: Duration(milliseconds: dragging ? 120 : 280),
        curve: dragging ? Curves.easeOut : Curves.elasticOut,
        offset: Offset(0, dragging ? -0.22 : 0),
        child: AnimatedScale(
          duration: Duration(milliseconds: dragging ? 120 : 280),
          curve: dragging ? Curves.easeOut : Curves.elasticOut,
          scale: dragging ? 1.12 : 1,
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 46,
                height: 46,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: AppTheme.brandGradient,
                  border: Border.all(color: Colors.white, width: 3),
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.navy.withValues(
                        alpha: dragging ? 0.35 : 0.22,
                      ),
                      blurRadius: dragging ? 16 : 10,
                      offset: Offset(0, dragging ? 10 : 4),
                    ),
                  ],
                ),
                child: const Icon(
                  Icons.place_rounded,
                  color: Colors.white,
                  size: 26,
                ),
              ),
              CustomPaint(
                size: const Size(16, 10),
                painter: _PinTailPainter(
                  color: AppColors.purple,
                ),
              ),
              AnimatedOpacity(
                duration: const Duration(milliseconds: 140),
                opacity: dragging ? 0.55 : 0,
                child: Container(
                  width: dragging ? 18 : 8,
                  height: 6,
                  margin: const EdgeInsets.only(top: 2),
                  decoration: BoxDecoration(
                    color: AppColors.navy.withValues(alpha: 0.28),
                    borderRadius: BorderRadius.circular(99),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PinTailPainter extends CustomPainter {
  _PinTailPainter({required this.color});

  final Color color;

  @override
  void paint(Canvas canvas, Size size) {
    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width / 2, size.height)
      ..lineTo(size.width, 0)
      ..close();
    canvas.drawPath(path, Paint()..color = color);
  }

  @override
  bool shouldRepaint(covariant _PinTailPainter oldDelegate) {
    return oldDelegate.color != color;
  }
}
