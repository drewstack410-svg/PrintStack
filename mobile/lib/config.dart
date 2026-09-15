import 'dart:io' show Platform;

class AppConfig {
  /// `true` = Vercel API, `false` = local API
  static const useVercel = bool.fromEnvironment(
    'USE_VERCEL',
    defaultValue: true,
  );

  static const localApiUrl = String.fromEnvironment(
    'API_URL',
    defaultValue: 'http://127.0.0.1:3001',
  );

  static const vercelApiUrl = String.fromEnvironment(
    'VERCEL_API_URL',
    defaultValue: 'https://print-stack-server.vercel.app',
  );

  static String get apiUrl => useVercel ? vercelApiUrl : localApiUrl;

  /// Cloud Map ID from Google Cloud → Maps → Map Management.
  /// Create an Android / iOS map ID there (cloud-based styling + modern map renderer).
  /// Pass at build time:
  /// `--dart-define=GOOGLE_MAPS_MAP_ID_ANDROID=...`
  /// `--dart-define=GOOGLE_MAPS_MAP_ID_IOS=...`
  /// or a shared `--dart-define=GOOGLE_MAPS_MAP_ID=...`
  static const googleMapsMapId = String.fromEnvironment(
    'GOOGLE_MAPS_MAP_ID',
    defaultValue: '57a5e418958e3cb7bb8e1abd',
  );
  static const googleMapsMapIdAndroid = String.fromEnvironment(
    'GOOGLE_MAPS_MAP_ID_ANDROID',
    defaultValue: '57a5e418958e3cb7bb8e1abd',
  );
  static const googleMapsMapIdIos = String.fromEnvironment(
    'GOOGLE_MAPS_MAP_ID_IOS',
    defaultValue: '57a5e418958e3cb7bb8e1abd',
  );

  /// Active Map ID for this platform (empty = default Google style).
  static String get cloudMapId {
    if (Platform.isIOS) {
      final ios = googleMapsMapIdIos.trim();
      if (ios.isNotEmpty) return ios;
    } else {
      final android = googleMapsMapIdAndroid.trim();
      if (android.isNotEmpty) return android;
    }
    return googleMapsMapId.trim();
  }

  /// Default camera when opening the Print map (Philippines).
  static const philippinesCenterLat = 12.8797;
  static const philippinesCenterLng = 121.7740;
  static const philippinesZoom = 5.6;
}
