import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/api_client.dart';
import '../components/common/status_chip.dart';
import '../components/partners/partner_avatar.dart';
import '../config.dart';
import '../models/partner.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import '../utils/directions_service.dart';
import '../utils/partner_map_markers.dart';
import 'partner_order_page.dart';

/// Print tab: Philippines map of partners + floating partner cards.
class PrintPage extends StatefulWidget {
  const PrintPage({super.key});

  @override
  State<PrintPage> createState() => _PrintPageState();
}

class _PrintPageState extends State<PrintPage> {
  late Stream<List<Partner>> _partnersStream;
  final _pageController = PageController(viewportFraction: 0.88);
  GoogleMapController? _mapController;
  Timer? _tick;
  StreamSubscription<Position>? _positionSub;

  List<Partner> _mappable = const [];
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};
  String? _selectedId;
  String? _routeSummary;
  bool _buildingMarkers = false;
  bool _buildingRoute = false;
  bool _myLocationEnabled = false;
  bool _didIntroFly = false;
  int _pageIndex = 0;
  LatLng? _myLatLng;

  static const _philippines = CameraPosition(
    target: LatLng(
      AppConfig.philippinesCenterLat,
      AppConfig.philippinesCenterLng,
    ),
    zoom: AppConfig.philippinesZoom,
  );

  @override
  void initState() {
    super.initState();
    _partnersStream = PartnersRepository.instance.watchPartners();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        setState(() {});
        unawaited(_rebuildMarkers(_mappable));
      }
    });
    unawaited(_enableMyLocation());
  }

  @override
  void dispose() {
    _tick?.cancel();
    _positionSub?.cancel();
    _pageController.dispose();
    _mapController?.dispose();
    super.dispose();
  }

  Future<void> _enableMyLocation() async {
    try {
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
        if (!mounted) {
          return;
        }
        setState(() => _myLocationEnabled = true);

        final current = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
          ),
        );
        if (!mounted) {
          return;
        }
        setState(() {
          _myLatLng = LatLng(current.latitude, current.longitude);
        });
        unawaited(_runIntroFlyIfReady());

        await _positionSub?.cancel();
        _positionSub = Geolocator.getPositionStream(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            distanceFilter: 8,
          ),
        ).listen((position) {
          if (!mounted) {
            return;
          }
          setState(() {
            _myLatLng = LatLng(position.latitude, position.longitude);
          });
        });
        return;
      }

      // Fallback: PrintStack API geolocation (IP / network).
      final located = await ApiClient.instance.locate();
      if (!mounted) {
        return;
      }
      setState(() {
        _myLatLng = LatLng(located.lat, located.lng);
        _myLocationEnabled = false;
      });
      unawaited(_runIntroFlyIfReady());
    } catch (error) {
      debugPrint('Location enable failed: $error');
      try {
        final located = await ApiClient.instance.locate();
        if (!mounted) {
          return;
        }
        setState(() {
          _myLatLng = LatLng(located.lat, located.lng);
        });
        unawaited(_runIntroFlyIfReady());
      } catch (apiError) {
        debugPrint('API locate failed: $apiError');
      }
    }
  }

  Future<void> _runIntroFlyIfReady() async {
    final controller = _mapController;
    final me = _myLatLng;
    if (_didIntroFly || controller == null || me == null) {
      return;
    }
    _didIntroFly = true;

    // Start on Philippines, then fly to the user.
    await controller.animateCamera(
      CameraUpdate.newCameraPosition(_philippines),
    );
    await Future<void>.delayed(const Duration(milliseconds: 700));
    if (!mounted || _mapController == null) {
      return;
    }
    await _mapController!.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: me, zoom: 14.5),
      ),
    );
  }

  Future<void> _goToMyLocation() async {
    if (!_myLocationEnabled) {
      await _enableMyLocation();
    }
    final point = _myLatLng;
    final controller = _mapController;
    if (point == null || controller == null) {
      return;
    }
    await controller.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: point, zoom: 15),
      ),
    );
  }

  List<Partner> _withLocations(List<Partner> partners) {
    return partners
        .where((p) {
          final loc = p.location;
          if (loc == null) {
            return false;
          }
          if (loc.lat == 0 && loc.lng == 0) {
            return false;
          }
          return PartnerMapMarkers.isInPhilippines(loc.lat, loc.lng);
        })
        .toList()
      ..sort((a, b) {
        final aOnline = a.location?.online == true ? 0 : 1;
        final bOnline = b.location?.online == true ? 0 : 1;
        if (aOnline != bOnline) {
          return aOnline.compareTo(bOnline);
        }
        return a.companyName.toLowerCase().compareTo(b.companyName.toLowerCase());
      });
  }

  Future<void> _rebuildMarkers(List<Partner> partners) async {
    if (_buildingMarkers) {
      return;
    }
    _buildingMarkers = true;
    try {
      final markers = await PartnerMapMarkers.build(
        partners: partners,
        selectedId: _selectedId,
        onTap: _selectPartner,
      );
      if (!mounted) {
        return;
      }
      setState(() => _markers = markers);
    } finally {
      _buildingMarkers = false;
    }
  }

  void _selectPartner(Partner partner, {bool animatePage = true}) {
    final index = _mappable.indexWhere((p) => p.id == partner.id);
    if (index < 0) {
      return;
    }

    setState(() {
      _selectedId = partner.id;
      _pageIndex = index;
    });
    unawaited(_rebuildMarkers(_mappable));
    unawaited(_drawRouteTo(partner));

    if (animatePage && _pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    }
  }

  Future<void> _drawRouteTo(Partner partner) async {
    final destination = partner.location;
    if (destination == null) {
      return;
    }
    final dest = LatLng(destination.lat, destination.lng);

    if (_myLatLng == null && _myLocationEnabled == false) {
      await _enableMyLocation();
    }
    final origin = _myLatLng;
    if (origin == null) {
      if (mounted) {
        setState(() {
          _polylines = {};
          _routeSummary = 'Turn on location to see the route.';
        });
      }
      await _focusPartner(partner);
      return;
    }

    if (_buildingRoute) {
      return;
    }
    _buildingRoute = true;
    try {
      final route = await DirectionsService.fetchRoute(
        origin: origin,
        destination: dest,
      );
      if (!mounted || route == null) {
        return;
      }

      final summary = [
        if (route.durationText.isNotEmpty) route.durationText,
        if (route.distanceText.isNotEmpty) route.distanceText,
      ].join(' · ');

      setState(() {
        _routeSummary = summary.isEmpty ? 'Route to partner' : summary;
        _polylines = {
          Polyline(
            polylineId: const PolylineId('route-to-partner'),
            points: route.points,
            color: AppColors.purpleDark,
            width: 5,
            startCap: Cap.roundCap,
            endCap: Cap.roundCap,
            jointType: JointType.round,
          ),
        };
      });

      await _fitRoute(route.points);
    } finally {
      _buildingRoute = false;
    }
  }

  Future<void> _fitRoute(List<LatLng> points) async {
    final controller = _mapController;
    if (controller == null || points.isEmpty) {
      return;
    }

    var minLat = points.first.latitude;
    var maxLat = points.first.latitude;
    var minLng = points.first.longitude;
    var maxLng = points.first.longitude;
    for (final point in points) {
      minLat = point.latitude < minLat ? point.latitude : minLat;
      maxLat = point.latitude > maxLat ? point.latitude : maxLat;
      minLng = point.longitude < minLng ? point.longitude : minLng;
      maxLng = point.longitude > maxLng ? point.longitude : maxLng;
    }

    await controller.animateCamera(
      CameraUpdate.newLatLngBounds(
        LatLngBounds(
          southwest: LatLng(minLat, minLng),
          northeast: LatLng(maxLat, maxLng),
        ),
        72,
      ),
    );
  }

  Future<void> _focusPartner(Partner partner) async {
    final loc = partner.location;
    final controller = _mapController;
    if (loc == null || controller == null) {
      return;
    }
    await controller.animateCamera(
      CameraUpdate.newCameraPosition(
        CameraPosition(target: LatLng(loc.lat, loc.lng), zoom: 14.5),
      ),
    );
  }

  void _openOrder(Partner partner) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PartnerOrderPage(partner: partner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Partner>>(
      stream: _partnersStream,
      builder: (context, snapshot) {
        final all = snapshot.data ?? const <Partner>[];
        final mappable = _withLocations(all);
        final nextIds = mappable.map((p) => p.id).join('|');
        final prevIds = _mappable.map((p) => p.id).join('|');

        if (nextIds != prevIds) {
          _mappable = mappable;
          if (_selectedId == null && mappable.isNotEmpty) {
            _selectedId = mappable.first.id;
          } else if (_selectedId != null &&
              mappable.every((p) => p.id != _selectedId)) {
            _selectedId = mappable.isEmpty ? null : mappable.first.id;
          }
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (mounted) {
              unawaited(_rebuildMarkers(mappable));
            }
          });
        }

        return Stack(
          fit: StackFit.expand,
          children: [
            GoogleMap(
              initialCameraPosition: _philippines,
              myLocationEnabled: _myLocationEnabled,
              myLocationButtonEnabled: false,
              compassEnabled: false,
              mapToolbarEnabled: false,
              zoomControlsEnabled: false,
              markers: _markers,
              polylines: _polylines,
              onMapCreated: (controller) async {
                _mapController = controller;
                // Always open on Philippines first.
                await controller.moveCamera(
                  CameraUpdate.newCameraPosition(_philippines),
                );
                await _runIntroFlyIfReady();
              },
            ),
            if (_routeSummary != null)
              Positioned(
                left: 16,
                right: 16,
                top: 12,
                child: Material(
                  color: Colors.white,
                  elevation: 3,
                  borderRadius: BorderRadius.circular(12),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 10,
                    ),
                    child: Row(
                      children: [
                        const Icon(
                          Icons.route,
                          color: AppColors.purpleDark,
                          size: 18,
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            _routeSummary!,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              color: AppColors.navy,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Positioned(
              right: 14,
              bottom: mappable.isEmpty ? 24 : 160,
              child: FloatingActionButton.small(
                heroTag: 'print-my-location',
                backgroundColor: Colors.white,
                foregroundColor: AppColors.purpleDark,
                onPressed: _goToMyLocation,
                child: const Icon(Icons.my_location),
              ),
            ),
            if (snapshot.connectionState == ConnectionState.waiting &&
                !snapshot.hasData)
              const Center(child: CircularProgressIndicator()),
            if (snapshot.hasError)
              Positioned(
                left: 16,
                right: 16,
                top: 16,
                child: Material(
                  color: const Color(0xFFFFEBEE),
                  borderRadius: BorderRadius.circular(14),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Text(
                      snapshot.error.toString(),
                      style: const TextStyle(color: Color(0xFFB71C1C)),
                    ),
                  ),
                ),
              ),
            if (!snapshot.hasError &&
                snapshot.hasData &&
                mappable.isEmpty)
              const Positioned(
                left: 24,
                right: 24,
                top: 24,
                child: _MapBanner(
                  title: 'No partner locations yet',
                  message:
                      'Partners with a Philippines location will appear on this map.',
                ),
              ),
            if (mappable.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 18,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    SizedBox(
                      height: 126,
                      child: PageView.builder(
                        controller: _pageController,
                        itemCount: mappable.length,
                        onPageChanged: (index) {
                          final partner = mappable[index];
                          setState(() => _pageIndex = index);
                          _selectPartner(partner, animatePage: false);
                        },
                        itemBuilder: (context, index) {
                          final partner = mappable[index];
                          final selected = partner.id == _selectedId;
                          return Padding(
                            padding: const EdgeInsets.symmetric(horizontal: 6),
                            child: Transform.scale(
                              scale: selected ? 1 : 0.96,
                              child: _FloatingPartnerCard(
                                partner: partner,
                                selected: selected,
                                onTap: () => _openOrder(partner),
                              ),
                            ),
                          );
                        },
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      '${_pageIndex + 1} / ${mappable.length}',
                      style: TextStyle(
                        color: AppColors.navy.withValues(alpha: 0.7),
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                        shadows: const [
                          Shadow(color: Colors.white, blurRadius: 8),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
          ],
        );
      },
    );
  }
}

class _FloatingPartnerCard extends StatelessWidget {
  const _FloatingPartnerCard({
    required this.partner,
    required this.selected,
    required this.onTap,
  });

  final Partner partner;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final location = partner.location;
    final online = location?.online == true;

    return Material(
      elevation: selected ? 10 : 5,
      shadowColor: Colors.black38,
      borderRadius: BorderRadius.circular(18),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 14, 12, 14),
          child: Row(
            children: [
              PartnerAvatar(
                url: partner.logoUrl,
                name: partner.companyName,
                size: 54,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Text(
                      partner.companyName.isEmpty
                          ? 'Untitled partner'
                          : partner.companyName,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      (location?.label ?? '').isEmpty
                          ? 'Philippines partner'
                          : location!.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 13,
                        height: 1.25,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  StatusChip(
                    label: online ? 'Online' : 'Offline',
                    active: online,
                  ),
                  const SizedBox(height: 8),
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 10,
                      vertical: 6,
                    ),
                    decoration: BoxDecoration(
                      gradient: AppTheme.brandGradient,
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: const Text(
                      'Print',
                      style: TextStyle(
                        color: Colors.white,
                        fontWeight: FontWeight.w800,
                        fontSize: 12,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapBanner extends StatelessWidget {
  const _MapBanner({required this.title, required this.message});

  final String title;
  final String message;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 4,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w800,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 4),
            Text(message, style: const TextStyle(color: AppColors.muted)),
          ],
        ),
      ),
    );
  }
}
