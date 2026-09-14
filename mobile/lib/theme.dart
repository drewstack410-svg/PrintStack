import 'package:flutter/material.dart';

class AppColors {
  static const cyan = Color(0xFF22D3EE);
  static const blue = Color(0xFF4F7CFF);
  static const purple = Color(0xFF7C5CFF);
  static const purpleDark = Color(0xFF3D1FA8);
  static const navy = Color(0xFF0B1220);
  /// Dark violet used by top/bottom bars.
  static const barDark = Color(0xFF24125C);
  static const mist = Color(0xFFF4F7FC);
  static const muted = Color(0xFF5B6475);
}

class AppTheme {
  static const brandGradient = LinearGradient(
    colors: [AppColors.cyan, AppColors.blue, AppColors.purple],
  );

  static ThemeData light() {
    final scheme = ColorScheme.fromSeed(
      seedColor: AppColors.blue,
      primary: AppColors.blue,
      secondary: AppColors.cyan,
      surface: Colors.white,
    );

    return ThemeData(
      colorScheme: scheme,
      scaffoldBackgroundColor: AppColors.mist,
      useMaterial3: true,
      fontFamily: 'Roboto',
      appBarTheme: const AppBarTheme(
        backgroundColor: AppColors.barDark,
        foregroundColor: Colors.white,
        elevation: 0,
        centerTitle: false,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: BorderSide(color: AppColors.blue.withValues(alpha: 0.18)),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: AppColors.purple, width: 1.6),
        ),
      ),
      filledButtonTheme: FilledButtonThemeData(
        style: FilledButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          minimumSize: const Size.fromHeight(52),
          shape: const StadiumBorder(),
          foregroundColor: AppColors.navy,
          side: BorderSide(color: AppColors.blue.withValues(alpha: 0.28)),
          textStyle: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
        ),
      ),
    );
  }
}
