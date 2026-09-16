import 'dart:async';

import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

import '../api/api_client.dart';
import '../components/partners/partner_avatar.dart';
import '../config.dart';
import '../models/partner.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import '../utils/directions_service.dart';
import '../utils/map_theme_styles.dart';
import '../utils/partner_map_markers.dart';
import 'shop_pricing_page.dart';

/// Print tab: Philippines map of partners + floating partner cards.
class PrintPage extends StatefulWidget {
  const PrintPage({
    super.key,
    this.onSearchFocusChanged,
  });

  final ValueChanged<bool>? onSearchFocusChanged;

  @override
  State<PrintPage> createState() => _PrintPageState();
}

class _PrintPageState extends State<PrintPage> {
  late Stream<List<Partner>> _partnersStream;
  /// Show ~3 partner cards at once in the bottom slider.
  final _pageController = PageController(viewportFraction: 0.28);
  final _searchController = TextEditingController();
  final _searchFocus = FocusNode();
  GoogleMapController? _mapController;
  Timer? _tick;
  StreamSubscription<Position>? _positionSub;

  List<Partner> _mappable = const [];
  Set<Marker> _markers = {};
  Set<Polyline> _polylines = {};
  DirectionsRoute? _activeRoute;
  String? _selectedId;
  String _query = '';
  bool _buildingMarkers = false;
  int _routeRequestId = 0;
  TravelMode _travelMode = TravelMode.drive;
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
    _partnersStream = PartnersRepository.instance.watchOnlinePartners();
    _searchFocus.addListener(() {
      if (!mounted) {
        return;
      }
      widget.onSearchFocusChanged?.call(_searchFocus.hasFocus);
      setState(() {});
    });
    _tick = Timer.periodic(const Duration(seconds: 15), (_) {
      if (mounted) {
        setState(() {});
        unawaited(_rebuildMarkers(_mappable));
      }
    });
    unawaited(_enableMyLocation());
  }

  @override
  void dispose() {
    widget.onSearchFocusChanged?.call(false);
    _tick?.cancel();
    _positionSub?.cancel();
    _pageController.dispose();
    _searchController.dispose();
    _searchFocus.dispose();
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

  bool _samePartnerOrder(List<Partner> a, List<Partner> b) {
    if (a.length != b.length) {
      return false;
    }
    for (var i = 0; i < a.length; i++) {
      if (a[i].id != b[i].id) {
        return false;
      }
    }
    return true;
  }

  double? _distanceMetersTo(Partner partner) {
    final me = _myLatLng;
    final loc = partner.location;
    if (me == null || loc == null) {
      return null;
    }
    return Geolocator.distanceBetween(
      me.latitude,
      me.longitude,
      loc.lat,
      loc.lng,
    );
  }

  String _formatDistance(double meters) {
    if (meters < 1000) {
      return '${meters.round()} m';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }

  List<Partner> _withLocations(List<Partner> partners) {
    return partners
        .where((p) {
          final loc = p.location;
          if (loc == null || loc.online != true) {
            return false;
          }
          if (loc.lat == 0 && loc.lng == 0) {
            return false;
          }
          return PartnerMapMarkers.isInPhilippines(loc.lat, loc.lng);
        })
        .toList()
      ..sort((a, b) {
        final aDist = _distanceMetersTo(a);
        final bDist = _distanceMetersTo(b);
        if (aDist != null && bDist != null) {
          final byDistance = aDist.compareTo(bDist);
          if (byDistance != 0) {
            return byDistance;
          }
        } else if (aDist != null) {
          return -1;
        } else if (bDist != null) {
          return 1;
        }

        return a.companyName
            .toLowerCase()
            .compareTo(b.companyName.toLowerCase());
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
    final requestId = ++_routeRequestId;

    if (_myLatLng == null && _myLocationEnabled == false) {
      await _enableMyLocation();
    }
    final origin = _myLatLng;
    if (origin == null) {
      if (mounted && requestId == _routeRequestId) {
        setState(() {
          _polylines = {};
          _activeRoute = null;
        });
      }
      await _focusPartner(partner);
      return;
    }

    try {
      final route = await DirectionsService.fetchRoute(
        origin: origin,
        destination: dest,
        mode: _travelMode,
      );
      if (!mounted || requestId != _routeRequestId || route == null) {
        return;
      }

      setState(() {
        _activeRoute = route;
        _polylines = brandGradientPolylines(
          route.points,
          idPrefix: 'brand-route-${_travelMode.apiValue}',
        );
      });

      await _fitRoute(route.points);
    } catch (error) {
      debugPrint('Route draw failed: $error');
    }
  }

  void _setTravelMode(TravelMode mode) {
    if (_travelMode == mode) {
      return;
    }
    setState(() => _travelMode = mode);
    final selected = _selectedPartner;
    if (selected != null) {
      unawaited(_drawRouteTo(selected));
    }
  }

  Partner? get _selectedPartner {
    if (_selectedId == null) {
      return null;
    }
    for (final partner in _mappable) {
      if (partner.id == _selectedId) {
        return partner;
      }
    }
    return null;
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
    if (partner.location?.online != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This shop is offline.')),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ShopPricingPage(partner: partner),
      ),
    );
  }

  List<Partner> _filterPartners(List<Partner> partners) {
    final q = _query.trim().toLowerCase();
    if (q.isEmpty) {
      return partners;
    }
    return partners.where((partner) {
      final name = partner.companyName.toLowerCase();
      final email = partner.email.toLowerCase();
      final label = (partner.location?.label ?? '').toLowerCase();
      return name.contains(q) || email.contains(q) || label.contains(q);
    }).toList(growable: false);
  }

  void _pickFromSearch(Partner partner, List<Partner> visible) {
    _searchFocus.unfocus();
    setState(() {
      _query = '';
      _searchController.clear();
    });
    _selectPartner(partner, animatePage: true);
    final index = visible.indexWhere((item) => item.id == partner.id);
    if (index >= 0 && _pageController.hasClients) {
      _pageController.animateToPage(
        index,
        duration: const Duration(milliseconds: 280),
        curve: Curves.easeOutCubic,
      );
    }
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
        final orderChanged =
            nextIds != prevIds || !_samePartnerOrder(_mappable, mappable);

        if (orderChanged) {
          _mappable = mappable;
          if (_selectedId == null && mappable.isNotEmpty) {
            _selectedId = mappable.first.id;
          } else if (_selectedId != null &&
              mappable.every((p) => p.id != _selectedId)) {
            _selectedId = mappable.isEmpty ? null : mappable.first.id;
            _polylines = {};
            _activeRoute = null;
          }
          final selectedIndex = _selectedId == null
              ? 0
              : mappable.indexWhere((p) => p.id == _selectedId);
          if (selectedIndex >= 0) {
            _pageIndex = selectedIndex;
          }
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (!mounted) {
              return;
            }
            unawaited(_rebuildMarkers(mappable));
            if (mappable.isNotEmpty &&
                _pageController.hasClients &&
                selectedIndex >= 0) {
              _pageController.jumpToPage(selectedIndex);
            }
          });
        }

        final searching = _searchFocus.hasFocus;
        final listPartners = _filterPartners(mappable);
        final carouselPartners = mappable;
        final selectedInCarousel = _selectedId == null
            ? -1
            : carouselPartners.indexWhere((p) => p.id == _selectedId);
        final carouselPageIndex =
            selectedInCarousel >= 0 ? selectedInCarousel : _pageIndex;

        return Stack(
          fit: StackFit.expand,
          children: [
            GoogleMap(
              mapId: AppConfig.cloudMapId.isEmpty ? null : AppConfig.cloudMapId,
              style: MapThemeStyles.light,
              initialCameraPosition: _philippines,
              myLocationEnabled: _myLocationEnabled,
              myLocationButtonEnabled: false,
              compassEnabled: false,
              mapToolbarEnabled: false,
              zoomControlsEnabled: false,
              trafficEnabled: true,
              markers: _markers,
              polylines: _polylines,
              onMapCreated: (controller) async {
                _mapController = controller;
                await controller.moveCamera(
                  CameraUpdate.newCameraPosition(_philippines),
                );
                await _runIntroFlyIfReady();
              },
              onTap: (_) => _searchFocus.unfocus(),
            ),
            Positioned(
              left: 12,
              right: 12,
              top: 10,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Material(
                    color: Colors.white,
                    elevation: 3,
                    borderRadius: BorderRadius.circular(12),
                    child: TextField(
                      controller: _searchController,
                      focusNode: _searchFocus,
                      onChanged: (value) => setState(() => _query = value),
                      onTap: () => setState(() {}),
                      textInputAction: TextInputAction.search,
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: searching
                            ? 'Nearby shops'
                            : 'Search shops…',
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        contentPadding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 12,
                        ),
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear',
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _query = '');
                                },
                                icon: const Icon(Icons.close, size: 18),
                              ),
                      ),
                    ),
                  ),
                  if (searching) ...[
                    const SizedBox(height: 6),
                    Material(
                      color: Colors.white,
                      elevation: 3,
                      borderRadius: BorderRadius.circular(12),
                      clipBehavior: Clip.antiAlias,
                      child: ConstrainedBox(
                        constraints: BoxConstraints(
                          maxHeight: MediaQuery.sizeOf(context).height * 0.45,
                        ),
                        child: listPartners.isEmpty
                            ? Padding(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 14,
                                  vertical: 14,
                                ),
                                child: Text(
                                  _query.trim().isEmpty
                                      ? 'No nearby shops online.'
                                      : 'No shops match that search.',
                                  style: const TextStyle(
                                    color: AppColors.muted,
                                    fontWeight: FontWeight.w600,
                                    fontSize: 13,
                                  ),
                                ),
                              )
                            : ListView.separated(
                                shrinkWrap: true,
                                padding: EdgeInsets.zero,
                                itemCount: listPartners.length,
                                separatorBuilder: (_, _) => const Divider(
                                  height: 1,
                                  indent: 12,
                                  endIndent: 12,
                                ),
                                itemBuilder: (context, index) {
                                  final partner = listPartners[index];
                                  final name = partner.companyName.isEmpty
                                      ? 'Shop'
                                      : partner.companyName;
                                  final distance =
                                      _distanceMetersTo(partner);
                                  final meta = [
                                    if ((partner.location?.label ?? '')
                                        .trim()
                                        .isNotEmpty)
                                      partner.location!.label.trim(),
                                    if (distance != null)
                                      _formatDistance(distance),
                                  ];
                                  return ListTile(
                                    dense: true,
                                    contentPadding: const EdgeInsets.symmetric(
                                      horizontal: 12,
                                      vertical: 2,
                                    ),
                                    leading: PartnerAvatar(
                                      url: partner.logoUrl,
                                      name: name,
                                      size: 34,
                                    ),
                                    title: Text(
                                      name,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontWeight: FontWeight.w800,
                                        fontSize: 13.5,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                    subtitle: meta.isEmpty
                                        ? null
                                        : Text(
                                            meta.join(' · '),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                            style: const TextStyle(
                                              color: AppColors.muted,
                                              fontSize: 11.5,
                                            ),
                                          ),
                                    onTap: () => _pickFromSearch(
                                      partner,
                                      carouselPartners,
                                    ),
                                  );
                                },
                              ),
                      ),
                    ),
                  ],
                  if (!searching &&
                      _activeRoute != null &&
                      (_activeRoute!.etaLabel.isNotEmpty ||
                          _activeRoute!.distanceText.isNotEmpty)) ...[
                    const SizedBox(height: 6),
                    _RouteTrafficChip(route: _activeRoute!),
                  ],
                  if (!searching) ...[
                    const SizedBox(height: 8),
                    _TravelModeBar(
                      selected: _travelMode,
                      onChanged: _setTravelMode,
                    ),
                  ],
                ],
              ),
            ),
            if (!searching)
              Positioned(
                right: 14,
                bottom: carouselPartners.isEmpty ? 24 : 148,
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
                top: 72,
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
                top: 72,
                child: _MapBanner(
                  title: 'No shops online',
                  message:
                      'Only active shops appear here. Check back when a partner comes online.',
                ),
              ),
            if (!searching && carouselPartners.isNotEmpty)
              Positioned(
                left: 0,
                right: 0,
                bottom: 12,
                child: _PartnerCarousel(
                  partners: carouselPartners,
                  selectedId: _selectedId,
                  pageIndex: carouselPageIndex.clamp(
                    0,
                    carouselPartners.length - 1,
                  ),
                  controller: _pageController,
                  distanceMetersFor: _distanceMetersTo,
                  selectedRoute: _activeRoute,
                  onPageChanged: (index) {
                    final partner = carouselPartners[index];
                    setState(() => _pageIndex = index);
                    _selectPartner(partner, animatePage: false);
                  },
                  onOpen: _openOrder,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _PartnerCarousel extends StatelessWidget {
  const _PartnerCarousel({
    required this.partners,
    required this.selectedId,
    required this.pageIndex,
    required this.controller,
    required this.distanceMetersFor,
    required this.onPageChanged,
    required this.onOpen,
    this.selectedRoute,
  });

  final List<Partner> partners;
  final String? selectedId;
  final int pageIndex;
  final PageController controller;
  final double? Function(Partner partner) distanceMetersFor;
  final ValueChanged<int> onPageChanged;
  final ValueChanged<Partner> onOpen;
  final DirectionsRoute? selectedRoute;

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          height: 96,
          child: PageView.builder(
            controller: controller,
            itemCount: partners.length,
            physics: const BouncingScrollPhysics(
              parent: PageScrollPhysics(),
            ),
            padEnds: true,
            onPageChanged: onPageChanged,
            itemBuilder: (context, index) {
              final partner = partners[index];
              final selected = partner.id == selectedId;
              return AnimatedScale(
                scale: selected ? 1 : 0.9,
                duration: const Duration(milliseconds: 220),
                curve: Curves.easeOutCubic,
                child: AnimatedOpacity(
                  opacity: selected ? 1 : 0.72,
                  duration: const Duration(milliseconds: 220),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 3),
                    child: _FloatingPartnerCard(
                      partner: partner,
                      selected: selected,
                      distanceMeters: distanceMetersFor(partner),
                      routeEta: selected ? selectedRoute?.etaLabel : null,
                      routeDistance: selected ? selectedRoute?.distanceText : null,
                      onTap: () => onOpen(partner),
                    ),
                  ),
                ),
              );
            },
          ),
        ),
        const SizedBox(height: 8),
        _PageDots(
          count: partners.length,
          index: pageIndex.clamp(0, partners.length - 1),
        ),
        const SizedBox(height: 2),
        Text(
          'Nearby · ${pageIndex + 1} / ${partners.length}',
          style: TextStyle(
            color: Colors.white.withValues(alpha: 0.88),
            fontWeight: FontWeight.w700,
            fontSize: 11,
            shadows: const [
              Shadow(color: Colors.black54, blurRadius: 8),
            ],
          ),
        ),
      ],
    );
  }
}

class _PageDots extends StatelessWidget {
  const _PageDots({required this.count, required this.index});

  final int count;
  final int index;

  @override
  Widget build(BuildContext context) {
    final visible = count > 8 ? 8 : count;
    final start = count <= 8
        ? 0
        : (index - 3).clamp(0, count - visible);

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: List.generate(visible, (i) {
        final realIndex = start + i;
        final active = realIndex == index;
        return AnimatedContainer(
          duration: const Duration(milliseconds: 180),
          margin: const EdgeInsets.symmetric(horizontal: 3),
          width: active ? 16 : 7,
          height: 7,
          decoration: BoxDecoration(
            color: active
                ? Colors.white
                : Colors.white.withValues(alpha: 0.35),
            borderRadius: BorderRadius.circular(999),
          ),
        );
      }),
    );
  }
}

class _FloatingPartnerCard extends StatelessWidget {
  const _FloatingPartnerCard({
    required this.partner,
    required this.selected,
    required this.onTap,
    this.distanceMeters,
    this.routeEta,
    this.routeDistance,
  });

  final Partner partner;
  final bool selected;
  final VoidCallback onTap;
  final double? distanceMeters;
  final String? routeEta;
  final String? routeDistance;

  String? get _distanceLabel {
    final route = routeDistance?.trim();
    if (route != null && route.isNotEmpty) {
      return route;
    }
    final meters = distanceMeters;
    if (meters == null) {
      return null;
    }
    if (meters < 1000) {
      return '${meters.round()} m';
    }
    return '${(meters / 1000).toStringAsFixed(1)} km';
  }

  @override
  Widget build(BuildContext context) {
    final location = partner.location;
    final online = location?.online == true;
    final distance = _distanceLabel;

    return Material(
      elevation: selected ? 10 : 4,
      shadowColor: Colors.black38,
      borderRadius: BorderRadius.circular(14),
      color: Colors.white,
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.fromLTRB(6, 8, 6, 8),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(14),
            color: Colors.white,
            border: Border.all(
              color: selected
                  ? AppColors.purple.withValues(alpha: 0.55)
                  : Colors.black.withValues(alpha: 0.06),
              width: 1.2,
            ),
            boxShadow: online
                ? [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.35),
                      blurRadius: 12,
                      spreadRadius: 0.5,
                    ),
                  ]
                : null,
          ),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              SizedBox(
                width: 34,
                height: 34,
                child: Stack(
                  clipBehavior: Clip.none,
                  alignment: Alignment.center,
                  children: [
                    PartnerAvatar(
                      url: partner.logoUrl,
                      name: partner.companyName,
                      size: 30,
                    ),
                    if (online)
                      const Positioned(
                        right: -2,
                        top: -2,
                        child: _OnlineGlowPing(),
                      ),
                  ],
                ),
              ),
              const SizedBox(height: 5),
              Text(
                partner.companyName.isEmpty
                    ? 'Untitled'
                    : partner.companyName,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w800,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                [
                  if ((routeEta ?? '').trim().isNotEmpty) routeEta!.trim(),
                  distance ??
                      ((location?.label ?? '').isEmpty
                          ? 'Nearby'
                          : location!.label),
                ].where((part) => part.trim().isNotEmpty).join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: AppColors.muted,
                  fontSize: 9,
                  height: 1.15,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OnlineGlowPing extends StatefulWidget {
  const _OnlineGlowPing();

  @override
  State<_OnlineGlowPing> createState() => _OnlineGlowPingState();
}

class _OnlineGlowPingState extends State<_OnlineGlowPing>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  )..repeat();

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 12,
      height: 12,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final t = _controller.value;
          final pulse = (1 - t);
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 11 * (0.55 + t * 0.9),
                height: 11 * (0.55 + t * 0.9),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22C55E).withValues(
                    alpha: 0.35 * pulse,
                  ),
                ),
              ),
              Container(
                width: 6,
                height: 6,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF16A34A),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.85),
                      blurRadius: 5,
                      spreadRadius: 0.5,
                    ),
                  ],
                  border: Border.all(color: Colors.white, width: 1.2),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RouteTrafficChip extends StatelessWidget {
  const _RouteTrafficChip({required this.route});

  final DirectionsRoute route;

  @override
  Widget build(BuildContext context) {
    final parts = <String>[
      if (route.distanceText.trim().isNotEmpty) route.distanceText.trim(),
      if (route.etaLabel.isNotEmpty) route.etaLabel,
      route.trafficLabel,
    ];

    return Material(
      color: Colors.white,
      elevation: 2,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        child: Row(
          children: [
            Container(
              width: 10,
              height: 10,
              decoration: BoxDecoration(
                color: route.lineColor,
                shape: BoxShape.circle,
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                parts.join(' · '),
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: const TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy,
                  fontSize: 12.5,
                ),
              ),
            ),
            const Icon(
              Icons.traffic_rounded,
              size: 16,
              color: AppColors.muted,
            ),
          ],
        ),
      ),
    );
  }
}

class _TravelModeBar extends StatelessWidget {
  const _TravelModeBar({
    required this.selected,
    required this.onChanged,
  });

  final TravelMode selected;
  final ValueChanged<TravelMode> onChanged;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      elevation: 3,
      borderRadius: BorderRadius.circular(12),
      child: Padding(
        padding: const EdgeInsets.all(4),
        child: Row(
          children: [
            for (final mode in TravelMode.values)
              Expanded(
                child: InkWell(
                  borderRadius: BorderRadius.circular(9),
                  onTap: () => onChanged(mode),
                  child: AnimatedContainer(
                    duration: const Duration(milliseconds: 160),
                    curve: Curves.easeOut,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    decoration: BoxDecoration(
                      color: selected == mode
                          ? AppColors.purple.withValues(alpha: 0.12)
                          : Colors.transparent,
                      borderRadius: BorderRadius.circular(9),
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(
                          mode.icon,
                          size: 18,
                          color: selected == mode
                              ? AppColors.purple
                              : AppColors.muted,
                        ),
                        const SizedBox(height: 2),
                        Text(
                          mode.label,
                          style: TextStyle(
                            fontSize: 10.5,
                            fontWeight: FontWeight.w800,
                            color: selected == mode
                                ? AppColors.navy
                                : AppColors.muted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
          ],
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
