import 'package:flutter/material.dart';

import '../../theme.dart';
import '../../utils/map_theme_controller.dart';

/// Compact toggle for Google Maps cloud light / dark scheme.
class MapThemeToggleButton extends StatelessWidget {
  const MapThemeToggleButton({
    super.key,
    this.heroTag = 'map-theme-toggle',
  });

  final String heroTag;

  @override
  Widget build(BuildContext context) {
    final controller = MapThemeController.instance;
    return AnimatedBuilder(
      animation: controller,
      builder: (context, _) {
        final dark = controller.isDark;
        return FloatingActionButton.small(
          heroTag: heroTag,
          backgroundColor: dark ? const Color(0xFF1F2937) : Colors.white,
          foregroundColor: dark ? Colors.white : AppColors.purpleDark,
          tooltip: dark ? 'Light map' : 'Dark map',
          onPressed: controller.toggle,
          child: Icon(dark ? Icons.light_mode_rounded : Icons.dark_mode_rounded),
        );
      },
    );
  }
}
