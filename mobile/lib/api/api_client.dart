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
  }) async {
    final token = await _idToken();
    final uri = Uri.parse('${AppConfig.apiUrl}$path');
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

    await ref.putFile(
      file,
      SettableMetadata(contentType: 'application/pdf'),
    );

    final fileUrl = await ref.getDownloadURL();
    return (fileUrl: fileUrl, filePath: objectPath);
  }

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

    return _request(
      'POST',
      '/api/partners/$partnerId/print-jobs',
      body: {
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
    );
  }
}
