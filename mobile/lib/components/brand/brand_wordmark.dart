import 'package:flutter/material.dart';

import '../../theme.dart';

class BrandWordmark extends StatelessWidget {
  const BrandWordmark({super.key, this.size = 28});

  final double size;

  @override
  Widget build(BuildContext context) {
    return ShaderMask(
      shaderCallback: (bounds) => AppTheme.brandGradient.createShader(bounds),
      child: Text(
        'PrintStack',
        style: TextStyle(
          fontSize: size,
          fontWeight: FontWeight.w800,
          color: Colors.white,
          letterSpacing: 0.3,
        ),
      ),
    );
  }
}
