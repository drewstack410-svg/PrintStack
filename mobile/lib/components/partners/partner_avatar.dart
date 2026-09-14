import 'package:flutter/material.dart';

import '../../theme.dart';

class PartnerAvatar extends StatelessWidget {
  const PartnerAvatar({
    super.key,
    required this.name,
    this.url = '',
    this.size = 52,
  });

  final String name;
  final String url;
  final double size;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial = trimmed.isEmpty ? 'P' : trimmed[0].toUpperCase();
    final radius = BorderRadius.circular(size * 0.27);

    Widget fallback() {
      return Container(
        width: size,
        height: size,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: AppTheme.brandGradient,
          borderRadius: radius,
        ),
        child: Text(
          initial,
          style: TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: size * 0.38,
          ),
        ),
      );
    }

    if (url.isEmpty) {
      return fallback();
    }

    return ClipRRect(
      borderRadius: radius,
      child: Image.network(
        url,
        width: size,
        height: size,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback(),
      ),
    );
  }
}
