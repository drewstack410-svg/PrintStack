import 'dart:typed_data';
import 'dart:ui' as ui;

import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';
import 'package:http/http.dart' as http;

import '../models/partner.dart';
import '../theme.dart';

/// Builds circular logo map pins for partners.
class PartnerMapMarkers {
  PartnerMapMarkers._();

  static final Map<String, BitmapDescriptor> _cache = {};

  static Future<Set<Marker>> build({
    required List<Partner> partners,
    required String? selectedId,
    required void Function(Partner partner) onTap,
  }) async {
    final markers = <Marker>{};
    for (final partner in partners) {
      final loc = partner.location;
      if (loc == null || !isInPhilippines(loc.lat, loc.lng)) {
        continue;
      }

      final icon = await descriptorFor(
        partner,
        selected: partner.id == selectedId,
      );

      markers.add(
        Marker(
          markerId: MarkerId(partner.id),
          position: LatLng(loc.lat, loc.lng),
          icon: icon,
          zIndexInt: partner.id == selectedId ? 2 : 1,
          infoWindow: InfoWindow(
            title: partner.companyName.isEmpty ? 'Shop' : partner.companyName,
            snippet: loc.label,
          ),
          onTap: () => onTap(partner),
        ),
      );
    }
    return markers;
  }

  static Future<BitmapDescriptor> descriptorFor(
    Partner partner, {
    required bool selected,
  }) async {
    final cacheKey = '${partner.id}|${partner.logoUrl}|$selected|lg';
    final cached = _cache[cacheKey];
    if (cached != null) {
      return cached;
    }

    final bytes = await _paintPin(
      logoUrl: partner.logoUrl,
      name: partner.companyName,
      selected: selected,
      online: partner.location?.online == true,
    );
    final descriptor = BitmapDescriptor.bytes(bytes, imagePixelRatio: 2.0);
    _cache[cacheKey] = descriptor;
    return descriptor;
  }

  static bool isInPhilippines(double lat, double lng) {
    // Rough mainland + island bounding box for PH.
    return lat >= 4.2 && lat <= 21.5 && lng >= 116.0 && lng <= 127.5;
  }

  static Future<Uint8List> _paintPin({
    required String logoUrl,
    required String name,
    required bool selected,
    required bool online,
  }) async {
    const size = 112.0;
    final recorder = ui.PictureRecorder();
    final canvas = Canvas(recorder);
    final center = const Offset(size / 2, size / 2 - 7);
    final radius = selected ? 30.0 : 26.0;

    // Soft shadow.
    final shadow = Paint()
      ..color = Colors.black.withValues(alpha: 0.26)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 5);
    canvas.drawCircle(center.translate(0, 2.5), radius + 2, shadow);

    // Outer ring.
    final ring = Paint()
      ..shader = const LinearGradient(
        colors: [AppColors.cyan, AppColors.blue, AppColors.purple],
      ).createShader(Rect.fromCircle(center: center, radius: radius + 5));
    canvas.drawCircle(center, radius + 4.5, ring);

    // White pad.
    canvas.drawCircle(center, radius + 1.2, Paint()..color = Colors.white);

    // Logo / initial fill.
    final clip = Path()
      ..addOval(Rect.fromCircle(center: center, radius: radius));
    canvas.save();
    canvas.clipPath(clip);

    final image = await _loadImage(logoUrl);
    if (image != null) {
      paintImage(
        canvas: canvas,
        rect: Rect.fromCircle(center: center, radius: radius),
        image: image,
        fit: BoxFit.cover,
        filterQuality: FilterQuality.high,
      );
    } else {
      final fill = Paint()
        ..shader = const LinearGradient(
          colors: [AppColors.cyan, AppColors.purple],
        ).createShader(Rect.fromCircle(center: center, radius: radius));
      canvas.drawCircle(center, radius, fill);
      final initial = name.trim().isEmpty ? 'P' : name.trim()[0].toUpperCase();
      final builder =
          ui.ParagraphBuilder(
              ui.ParagraphStyle(
                textAlign: TextAlign.center,
                fontSize: 22,
                fontWeight: FontWeight.w800,
              ),
            )
            ..pushStyle(ui.TextStyle(color: Colors.white))
            ..addText(initial);
      final paragraph = builder.build()
        ..layout(ui.ParagraphConstraints(width: radius * 2));
      canvas.drawParagraph(
        paragraph,
        Offset(center.dx - radius, center.dy - paragraph.height / 2),
      );
    }
    canvas.restore();

    // Online / offline badge.
    final badgeCenter = Offset(
      center.dx + radius * 0.72,
      center.dy + radius * 0.72,
    );
    canvas.drawCircle(badgeCenter, 8, Paint()..color = Colors.white);
    canvas.drawCircle(
      badgeCenter,
      6,
      Paint()
        ..color = online ? const Color(0xFF2E7D32) : const Color(0xFF9E9E9E),
    );

    // Pin tip.
    final tip = Path()
      ..moveTo(center.dx - 9, center.dy + radius - 1)
      ..lineTo(center.dx + 9, center.dy + radius - 1)
      ..lineTo(center.dx, size - 5)
      ..close();
    canvas.drawPath(
      tip,
      Paint()
        ..shader = const LinearGradient(
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
          colors: [AppColors.blue, AppColors.purpleDark],
        ).createShader(Rect.fromLTWH(0, 0, size, size)),
    );

    final picture = recorder.endRecording();
    final rendered = await picture.toImage(size.toInt(), size.toInt());
    final data = await rendered.toByteData(format: ui.ImageByteFormat.png);
    return data!.buffer.asUint8List();
  }

  static Future<ui.Image?> _loadImage(String url) async {
    if (url.trim().isEmpty) {
      return null;
    }
    try {
      final response = await http
          .get(Uri.parse(url))
          .timeout(const Duration(seconds: 6));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        return null;
      }
      final codec = await ui.instantiateImageCodec(
        response.bodyBytes,
        targetWidth: 96,
      );
      final frame = await codec.getNextFrame();
      return frame.image;
    } catch (_) {
      return null;
    }
  }
}
