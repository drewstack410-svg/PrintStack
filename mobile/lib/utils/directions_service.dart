import 'package:flutter/material.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/api_client.dart';
import '../theme.dart';

enum RouteTrafficLevel { light, moderate, heavy, unknown }

enum TravelMode {
  drive,
  walk,
  bicycle,
  transit,
}

extension TravelModeX on TravelMode {
  String get apiValue {
    switch (this) {
      case TravelMode.drive:
        return 'drive';
      case TravelMode.walk:
        return 'walk';
      case TravelMode.bicycle:
        return 'bicycle';
      case TravelMode.transit:
        return 'transit';
    }
  }

  String get label {
    switch (this) {
      case TravelMode.drive:
        return 'Drive';
      case TravelMode.walk:
        return 'Walk';
      case TravelMode.bicycle:
        return 'Bike';
      case TravelMode.transit:
        return 'Transit';
    }
  }

  IconData get icon {
    switch (this) {
      case TravelMode.drive:
        return Icons.directions_car_filled_rounded;
      case TravelMode.walk:
        return Icons.directions_walk_rounded;
      case TravelMode.bicycle:
        return Icons.directions_bike_rounded;
      case TravelMode.transit:
        return Icons.directions_bus_filled_rounded;
    }
  }
}

class DirectionsRoute {
  const DirectionsRoute({
    required this.points,
    this.distanceText = '',
    this.durationText = '',
    this.durationInTrafficText = '',
    this.trafficLevel = RouteTrafficLevel.unknown,
    this.hasTraffic = false,
    this.source = '',
    this.travelMode = TravelMode.walk,
  });

  final List<LatLng> points;
  final String distanceText;
  final String durationText;
  final String durationInTrafficText;
  final RouteTrafficLevel trafficLevel;
  final bool hasTraffic;
  final String source;
  final TravelMode travelMode;

  String get etaLabel {
    final traffic = durationInTrafficText.trim();
    if (traffic.isNotEmpty) {
      return traffic;
    }
    return durationText.trim();
  }

  Color get lineColor => AppColors.purple;

  String get trafficLabel {
    switch (trafficLevel) {
      case RouteTrafficLevel.light:
        return 'Light traffic';
      case RouteTrafficLevel.moderate:
        return 'Moderate traffic';
      case RouteTrafficLevel.heavy:
        return 'Heavy traffic';
      case RouteTrafficLevel.unknown:
        return hasTraffic ? 'Live traffic' : 'Route';
    }
  }
}

/// Builds a violet route line matching the map pin color.
Set<Polyline> brandGradientPolylines(
  List<LatLng> points, {
  int width = 6,
  int steps = 36,
  String idPrefix = 'brand-route',
  Color color = AppColors.purple,
}) {
  if (points.length < 2) {
    return {};
  }

  return {
    Polyline(
      polylineId: PolylineId(idPrefix),
      points: points,
      color: color,
      width: width,
      startCap: Cap.roundCap,
      endCap: Cap.roundCap,
      jointType: JointType.round,
      geodesic: false,
    ),
  };
}

RouteTrafficLevel _parseTrafficLevel(String raw) {
  switch (raw.trim().toLowerCase()) {
    case 'light':
      return RouteTrafficLevel.light;
    case 'moderate':
      return RouteTrafficLevel.moderate;
    case 'heavy':
      return RouteTrafficLevel.heavy;
    default:
      return RouteTrafficLevel.unknown;
  }
}

/// Fetches routes through the PrintStack API for the selected travel mode.
class DirectionsService {
  DirectionsService._();

  static Future<DirectionsRoute?> fetchRoute({
    required LatLng origin,
    required LatLng destination,
    TravelMode mode = TravelMode.walk,
  }) async {
    try {
      final route = await ApiClient.instance.fetchRoute(
        fromLat: origin.latitude,
        fromLng: origin.longitude,
        toLat: destination.latitude,
        toLng: destination.longitude,
        mode: mode.apiValue,
      );

      final points = route.points
          .map((p) => LatLng(p.lat, p.lng))
          .where((p) => p.latitude != 0 || p.longitude != 0)
          .toList();

      if (points.length < 2) {
        return DirectionsRoute(
          points: [origin, destination],
          source: 'fallback',
          travelMode: mode,
        );
      }

      return DirectionsRoute(
        points: points,
        distanceText: route.distanceText,
        durationText: route.durationText,
        durationInTrafficText: route.durationInTrafficText,
        trafficLevel: _parseTrafficLevel(route.trafficLevel),
        hasTraffic: route.hasTraffic,
        source: route.source,
        travelMode: mode,
      );
    } catch (error) {
      debugPrint('Directions via API failed: $error');
      return DirectionsRoute(
        points: [origin, destination],
        source: 'fallback',
        travelMode: mode,
      );
    }
  }
}
