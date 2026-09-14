import 'package:flutter/foundation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/api_client.dart';

class DirectionsRoute {
  const DirectionsRoute({
    required this.points,
    this.distanceText = '',
    this.durationText = '',
  });

  final List<LatLng> points;
  final String distanceText;
  final String durationText;
}

/// Fetches driving routes through the PrintStack API.
class DirectionsService {
  DirectionsService._();

  static Future<DirectionsRoute?> fetchRoute({
    required LatLng origin,
    required LatLng destination,
  }) async {
    try {
      final route = await ApiClient.instance.fetchRoute(
        fromLat: origin.latitude,
        fromLng: origin.longitude,
        toLat: destination.latitude,
        toLng: destination.longitude,
      );

      final points = route.points
          .map((p) => LatLng(p.lat, p.lng))
          .where((p) => p.latitude != 0 || p.longitude != 0)
          .toList();

      if (points.length < 2) {
        return DirectionsRoute(points: [origin, destination]);
      }

      return DirectionsRoute(
        points: points,
        distanceText: route.distanceText,
        durationText: route.durationText,
      );
    } catch (error) {
      debugPrint('Directions via API failed: $error');
      return DirectionsRoute(points: [origin, destination]);
    }
  }
}
