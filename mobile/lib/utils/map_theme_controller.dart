import 'package:flutter/foundation.dart';
import 'package:google_maps_flutter/google_maps_flutter.dart';

/// App-wide Google Map light/dark preference (cloud Map ID color scheme).
class MapThemeController extends ChangeNotifier {
  MapThemeController._();
  static final MapThemeController instance = MapThemeController._();

  bool _isDark = false;

  bool get isDark => _isDark;

  MapColorScheme get colorScheme =>
      _isDark ? MapColorScheme.dark : MapColorScheme.light;

  void setDark(bool value) {
    if (_isDark == value) return;
    _isDark = value;
    notifyListeners();
  }

  void toggle() => setDark(!_isDark);
}
