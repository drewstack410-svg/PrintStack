import 'package:flutter/material.dart';

import '../theme.dart';
import '../utils/map_theme_controller.dart';

class SettingsPage extends StatelessWidget {
  const SettingsPage({super.key});

  @override
  Widget build(BuildContext context) {
    final mapTheme = MapThemeController.instance;

    return AnimatedBuilder(
      animation: mapTheme,
      builder: (context, _) {
        return ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
              ),
              child: SwitchListTile(
                value: mapTheme.isDark,
                onChanged: mapTheme.setDark,
                secondary: const Icon(
                  Icons.dark_mode_outlined,
                  color: AppColors.purple,
                ),
                title: const Text(
                  'Dark map',
                  style: TextStyle(
                    color: AppColors.navy,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                subtitle: const Text(
                  'Use dark styling when viewing shop locations.',
                ),
              ),
            ),
          ],
        );
      },
    );
  }
}
