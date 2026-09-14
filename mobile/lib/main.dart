import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:google_maps_flutter_android/google_maps_flutter_android.dart';
import 'package:google_maps_flutter_platform_interface/google_maps_flutter_platform_interface.dart';
import 'package:pdfrx/pdfrx.dart';

import 'auth/auth_gate.dart';
import 'firebase_options.dart';
import 'theme.dart';

Future<void> _initGoogleMaps() async {
  if (kIsWeb) {
    return;
  }
  final impl = GoogleMapsFlutterPlatform.instance;
  if (impl is GoogleMapsFlutterAndroid) {
    impl.useAndroidViewSurface = true;
    await impl.initializeWithRenderer(AndroidMapRenderer.latest);
  }
}

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  try {
    await _initGoogleMaps();
  } catch (error, stack) {
    debugPrint('Google Maps init failed: $error\n$stack');
  }
  try {
    await pdfrxFlutterInitialize();
  } catch (error, stack) {
    // Native PDFium may be missing after a bad Android build; app still runs
    // and PDF analysis falls back to content heuristics.
    debugPrint('pdfrx init failed: $error\n$stack');
  }
  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);
  runApp(const PrintStackApp());
}

class PrintStackApp extends StatelessWidget {
  const PrintStackApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'PrintStack',
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: const AuthGate(),
    );
  }
}
