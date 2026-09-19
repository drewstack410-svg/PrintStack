import 'package:flutter/material.dart';

class ListSkeleton extends StatefulWidget {
  const ListSkeleton({super.key, this.itemCount = 5, this.showFilter = true});

  final int itemCount;
  final bool showFilter;

  @override
  State<ListSkeleton> createState() => _ListSkeletonState();
}

class _ListSkeletonState extends State<ListSkeleton>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1100),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final shade = Color.lerp(
          const Color(0xFFE2E5EC),
          const Color(0xFFF3F4F8),
          (0.5 - (_controller.value - 0.5).abs()) * 2,
        )!;

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            if (widget.showFilter) ...[
              _SkeletonBox(height: 52, color: shade, radius: 12),
              const SizedBox(height: 14),
            ],
            _SkeletonBox(height: 12, width: 72, color: shade, radius: 6),
            const SizedBox(height: 10),
            ...List.generate(
              widget.itemCount,
              (_) => Padding(
                padding: const EdgeInsets.only(bottom: 10),
                child: Container(
                  height: 82,
                  padding: const EdgeInsets.all(13),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    children: [
                      _SkeletonBox(
                        width: 44,
                        height: 44,
                        color: shade,
                        radius: 11,
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            _SkeletonBox(
                              height: 14,
                              width: 145,
                              color: shade,
                              radius: 6,
                            ),
                            const SizedBox(height: 9),
                            _SkeletonBox(height: 11, color: shade, radius: 6),
                          ],
                        ),
                      ),
                      const SizedBox(width: 16),
                      _SkeletonBox(
                        width: 62,
                        height: 24,
                        color: shade,
                        radius: 12,
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}

class _SkeletonBox extends StatelessWidget {
  const _SkeletonBox({
    required this.height,
    required this.color,
    required this.radius,
    this.width,
  });

  final double height;
  final double? width;
  final Color color;
  final double radius;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: width,
      height: height,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(radius),
      ),
    );
  }
}
