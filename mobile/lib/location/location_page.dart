import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/api_client.dart';
import '../config.dart';
import '../theme.dart';
import '../utils/map_theme_styles.dart';
import 'animated_map_pin.dart';
import 'location_place.dart';
import 'location_search_bar.dart';

/// Location module: search an address and refine it by dragging the map pin.
class LocationPage extends StatefulWidget {
  const LocationPage({super.key});

  @override
  State<LocationPage> createState() => _LocationPageState();
}

class _LocationPageState extends State<LocationPage> {
  GoogleMapController? _mapController;
  Timer? _geocodeDebounce;

  LatLng _pin = const LatLng(
    AppConfig.philippinesCenterLat,
    AppConfig.philippinesCenterLng,
  );
  String _label = '';
  bool _dragging = false;
  bool _locating = false;
  bool _resolvingLabel = false;
  bool _didInitialLocate = false;
  String? _error;

  static const _initialCamera = CameraPosition(
    target: LatLng(
      AppConfig.philippinesCenterLat,
      AppConfig.philippinesCenterLng,
    ),
    zoom: AppConfig.philippinesZoom,
  );

  @override
  void dispose() {
    _geocodeDebounce?.cancel();
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _onMapCreated(GoogleMapController controller) async {
    _mapController = controller;
    if (!_didInitialLocate) {
      _didInitialLocate = true;
      await _useMyLocation(fly: true);
    }
  }

  Future<void> _useMyLocation({bool fly = true}) async {
    setState(() {
      _locating = true;
      _error = null;
    });

    try {
      LatLng? point;
      String? label;

      final serviceOn = await Geolocator.isLocationServiceEnabled();
      var permission = LocationPermission.denied;
      if (serviceOn) {
        permission = await Geolocator.checkPermission();
        if (permission == LocationPermission.denied) {
          permission = await Geolocator.requestPermission();
        }
      }

      final allowed = serviceOn &&
          permission != LocationPermission.denied &&
          permission != LocationPermission.deniedForever;

      if (allowed) {
        final position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        );
        point = LatLng(position.latitude, position.longitude);
      } else {
        final located = await ApiClient.instance.locate();
        point = LatLng(located.lat, located.lng);
        label = located.label;
      }

      if (!mounted || point == null) {
        return;
      }

      setState(() {
        _pin = point!;
        if (label != null && label.isNotEmpty) {
          _label = label;
        }
      });

      if (fly && _mapController != null) {
        await _mapController!.animateCamera(
          CameraUpdate.newCameraPosition(
            CameraPosition(target: point, zoom: 16),
          ),
        );
      }

      if (label == null || label.isEmpty) {
        await _resolveLabel(point);
      }
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() => _error = error.toString());
    } finally {
      if (mounted) {
        setState(() => _locating = false);
      }
    }
  }

  void _onCameraMoveStarted() {
    if (!_dragging) {
      setState(() => _dragging = true);
    }
  }

  void _onCameraMove(CameraPosition position) {
    _pin = position.target;
  }

  void _onCameraIdle() {
    if (_dragging) {
      setState(() => _dragging = false);
    }
    _scheduleResolveLabel(_pin);
  }

  void _scheduleResolveLabel(LatLng point) {
    _geocodeDebounce?.cancel();
    _geocodeDebounce = Timer(const Duration(milliseconds: 450), () {
      unawaited(_resolveLabel(point));
    });
  }

  Future<void> _resolveLabel(LatLng point) async {
    setState(() => _resolvingLabel = true);
    try {
      final label = await ApiClient.instance.reverseGeocode(
        lat: point.latitude,
        lng: point.longitude,
      );
      if (!mounted) {
        return;
      }
      setState(() {
        _label = label.isEmpty
            ? '${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}'
            : label;
        _error = null;
      });
    } catch (error) {
      if (!mounted) {
        return;
      }
      setState(() {
        _label =
            '${point.latitude.toStringAsFixed(5)}, ${point.longitude.toStringAsFixed(5)}';
        _error = error.toString();
      });
    } finally {
      if (mounted) {
        setState(() => _resolvingLabel = false);
      }
    }
  }

  Future<void> _goToPlace(LocationPlace place) async {
    final target = LatLng(place.lat, place.lng);
    setState(() {
      _pin = target;
      _label = place.label;
      _error = null;
    });
    final controller = _mapController;
    if (controller == null) {
      return;
    }
    await controller.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: target, zoom: 16.5),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        GoogleMap(
          mapId: AppConfig.cloudMapId.isEmpty ? null : AppConfig.cloudMapId,
          style: MapThemeStyles.light,
          initialCameraPosition: _initialCamera,
          myLocationEnabled: false,
          myLocationButtonEnabled: false,
          zoomControlsEnabled: false,
          compassEnabled: false,
          mapToolbarEnabled: false,
          trafficEnabled: true,
          onMapCreated: _onMapCreated,
          onCameraMoveStarted: _onCameraMoveStarted,
          onCameraMove: _onCameraMove,
          onCameraIdle: _onCameraIdle,
        ),
        Align(
          alignment: const Alignment(0, -0.04),
          child: AnimatedMapPin(dragging: _dragging),
        ),
        Positioned(
          top: 12,
          left: 12,
          right: 12,
          child: LocationSearchBar(
            onPlaceSelected: (place) {
              unawaited(_goToPlace(place));
            },
          ),
        ),
        Positioned(
          right: 16,
          bottom: 132,
          child: FloatingActionButton.small(
            heroTag: 'location-my-location',
            onPressed: _locating ? null : () => unawaited(_useMyLocation()),
            backgroundColor: Colors.white,
            foregroundColor: AppColors.purpleDark,
            child: _locating
                ? const SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.my_location_rounded),
          ),
        ),
        Positioned(
          left: 12,
          right: 12,
          bottom: 16,
          child: Material(
            elevation: 6,
            shadowColor: AppColors.navy.withValues(alpha: 0.18),
            borderRadius: BorderRadius.circular(16),
            color: Colors.white,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(14, 12, 14, 12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Row(
                    children: [
                      const Icon(
                        Icons.place_rounded,
                        color: AppColors.purpleDark,
                        size: 20,
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: Text(
                          _dragging
                              ? 'Move the map to place the pin…'
                              : (_resolvingLabel
                                  ? 'Finding address…'
                                  : (_label.isEmpty
                                      ? 'Your selected location'
                                      : _label)),
                          maxLines: 3,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w700,
                            color: AppColors.navy,
                            height: 1.25,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    _dragging
                        ? 'Release to drop the pin'
                        : 'Drag the map to adjust the pin',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      _error!,
                      style: TextStyle(
                        color: Colors.orange.shade800,
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }
}
