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

  /// Default camera when opening the Print map (Philippines).
  static const philippinesCenterLat = 12.8797;
  static const philippinesCenterLng = 121.7740;
  static const philippinesZoom = 5.6;
}
