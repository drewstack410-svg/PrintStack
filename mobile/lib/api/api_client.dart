import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';
import 'package:http/http.dart' as http;

import '../config.dart';
import '../models/partner.dart';

class ApiException implements Exception {
  const ApiException(this.message);
  final String message;

  @override
  String toString() => message;
}

class ApiClient {
  ApiClient({
    FirebaseAuth? auth,
    FirebaseStorage? storage,
    http.Client? httpClient,
  }) : _auth = auth ?? FirebaseAuth.instance,
       _storage = storage ?? FirebaseStorage.instance,
       _http = httpClient ?? http.Client();

  static final ApiClient instance = ApiClient();

  final FirebaseAuth _auth;
  final FirebaseStorage _storage;
  final http.Client _http;

  Future<String> _idToken() async {
    final user = _auth.currentUser;
    if (user == null) {
      throw const ApiException('You need to sign in first.');
    }
    final token = await user.getIdToken();
    if (token == null || token.isEmpty) {
      throw const ApiException('Could not get auth token.');
    }
    return token;
  }

  Future<Map<String, dynamic>> _request(
    String method,
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? query,
  }) async {
    final token = await _idToken();
    final uri = Uri.parse(
      '${AppConfig.apiUrl}$path',
    ).replace(queryParameters: query == null || query.isEmpty ? null : query);
    final headers = {
      'Authorization': 'Bearer $token',
      'Accept': 'application/json',
      if (body != null) 'Content-Type': 'application/json',
    };

    late http.Response response;
    if (method == 'POST') {
      response = await _http.post(
        uri,
        headers: headers,
        body: body == null ? null : jsonEncode(body),
      );
    } else {
      response = await _http.get(uri, headers: headers);
    }

    final payload = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        (payload['error'] ?? 'Request failed (${response.statusCode})')
            .toString(),
      );
    }
    return payload;
  }

  Map<String, dynamic> _decode(String body) {
    if (body.isEmpty) {
      return {};
    }
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    return {};
  }

  Future<List<Partner>> listPartners() async {
    final payload = await _request('GET', '/api/partners');
    final raw = payload['partners'];
    if (raw is! List) {
      return const [];
    }
    return raw
        .whereType<Map>()
        .map((item) => Partner.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }

  Future<({String fileUrl, String filePath})> uploadPrintPdf({
    required String partnerId,
    required File file,
    required String fileName,
  }) async {
    final user = _auth.currentUser;
    if (user == null) {
      throw const ApiException('You need to sign in first.');
    }

    final safeName = fileName.replaceAll(RegExp(r'[^\w.\- ]+'), '_');
    final objectPath =
        'partners/$partnerId/jobs/${user.uid}/${DateTime.now().millisecondsSinceEpoch}_$safeName';
    final ref = _storage.ref(objectPath);

    await ref.putFile(file, SettableMetadata(contentType: 'application/pdf'));

    final fileUrl = await ref.getDownloadURL();
    return (fileUrl: fileUrl, filePath: objectPath);
  }

  Future<Map<String, dynamic>> createCustomerPrintOrder({
    required String partnerId,
    required List<Map<String, dynamic>> documents,
  }) {
    if (documents.isEmpty) {
      throw const ApiException('Add at least one document to the order.');
    }

    return _request(
      'POST',
      '/api/partners/$partnerId/print-jobs',
      body: {'documents': documents},
    );
  }

  Future<Map<String, dynamic>> createPrintOrderPaymentIntent({
    required String partnerId,
    required String printJobId,
  }) {
    return _request(
      'POST',
      '/api/payments/print-order/intent',
      body: {'partnerId': partnerId, 'printJobId': printJobId},
    );
  }

  Future<Map<String, dynamic>> payPrintOrder({
    required String paymentIntentId,
    required String clientKey,
    required String paymentMethodType,
    required Map<String, dynamic> billing,
    String? returnPath,
  }) {
    return _request(
      'POST',
      '/api/payments/print-order/pay',
      body: {
        'paymentIntentId': paymentIntentId,
        'clientKey': clientKey,
        'paymentMethodType': paymentMethodType,
        'billing': billing,
        if (returnPath != null && returnPath.trim().isNotEmpty)
          'returnPath': returnPath.trim(),
      },
    );
  }

  Future<Map<String, dynamic>> finalizePrintOrderPayment(
    String paymentIntentId,
  ) {
    return _request(
      'POST',
      '/api/payments/print-order/finalize',
      body: {'paymentIntentId': paymentIntentId},
    );
  }

  @Deprecated('Use createCustomerPrintOrder with documents list')
  Future<Map<String, dynamic>> createCustomerPrintJob({
    required String partnerId,
    required String documentName,
    required String fileUrl,
    required String filePath,
    required String paperSizeId,
    required int copies,
    int pages = 1,
    int bwPages = 1,
    int colorPages = 0,
    String colorMode = 'bw',
  }) {
    final resolvedMode = colorPages > 0 && bwPages > 0
        ? 'mixed'
        : colorPages > 0
        ? 'color'
        : colorMode == 'color'
        ? 'color'
        : 'bw';

    return createCustomerPrintOrder(
      partnerId: partnerId,
      documents: [
        {
          'documentName': documentName,
          'fileUrl': fileUrl,
          'filePath': filePath,
          'paperSizeId': paperSizeId,
          'copies': copies,
          'pages': pages,
          'bwPages': bwPages,
          'colorPages': colorPages,
          'colorMode': resolvedMode,
        },
      ],
    );
  }

  Future<({double lat, double lng, String label})> locate() async {
    final payload = await _request('POST', '/api/geo/locate');
    final location = payload['location'];
    if (location is! Map) {
      throw const ApiException('Could not determine location.');
    }
    return (
      lat: (location['lat'] as num?)?.toDouble() ?? 0,
      lng: (location['lng'] as num?)?.toDouble() ?? 0,
      label: (location['label'] ?? '').toString(),
    );
  }

  Future<String> reverseGeocode({
    required double lat,
    required double lng,
  }) async {
    final payload = await _request(
      'GET',
      '/api/geo/reverse',
      query: {'lat': lat.toString(), 'lng': lng.toString()},
    );
    return (payload['label'] ?? '').toString();
  }

  Future<
    List<({String id, String label, double lat, double lng})>
  >
  autocompletePlaces(String query) async {
    final text = query.trim();
    if (text.length < 2) {
      return const [];
    }

    final payload = await _request(
      'GET',
      '/api/geo/autocomplete',
      query: {'q': text},
    );
    final raw = payload['results'];
    if (raw is! List) {
      return const [];
    }

    return raw
        .whereType<Map>()
        .map((item) {
          final lat = (item['lat'] as num?)?.toDouble();
          final lng = (item['lng'] as num?)?.toDouble();
          if (lat == null || lng == null) {
            return null;
          }
          return (
            id: (item['id'] ?? '$lat,$lng').toString(),
            label: (item['label'] ?? '').toString(),
            lat: lat,
            lng: lng,
          );
        })
        .whereType<({String id, String label, double lat, double lng})>()
        .toList(growable: false);
  }

  Future<
    ({
      List<({double lat, double lng})> points,
      String distanceText,
      String durationText,
      String durationInTrafficText,
      String trafficLevel,
      bool hasTraffic,
      String source,
    })
  >
  fetchRoute({
    required double fromLat,
    required double fromLng,
    required double toLat,
    required double toLng,
  }) async {
    final payload = await _request(
      'GET',
      '/api/geo/route',
      query: {
        'fromLat': fromLat.toString(),
        'fromLng': fromLng.toString(),
        'toLat': toLat.toString(),
        'toLng': toLng.toString(),
      },
    );
    final route = payload['route'];
    if (route is! Map) {
      throw const ApiException('Could not build a route.');
    }

    final rawPoints = route['points'];
    final points = <({double lat, double lng})>[];
    if (rawPoints is List) {
      for (final item in rawPoints) {
        if (item is Map) {
          points.add((
            lat: (item['lat'] as num?)?.toDouble() ?? 0,
            lng: (item['lng'] as num?)?.toDouble() ?? 0,
          ));
        }
      }
    }

    return (
      points: points,
      distanceText: (route['distanceText'] ?? '').toString(),
      durationText: (route['durationText'] ?? '').toString(),
      durationInTrafficText: (route['durationInTrafficText'] ?? '').toString(),
      trafficLevel: (route['trafficLevel'] ?? 'unknown').toString(),
      hasTraffic: route['hasTraffic'] == true,
      source: (route['source'] ?? '').toString(),
    );
  }
}
