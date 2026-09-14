import 'dart:convert';

import 'package:firebase_auth/firebase_auth.dart';
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
  ApiClient({FirebaseAuth? auth, http.Client? httpClient})
    : _auth = auth ?? FirebaseAuth.instance,
      _http = httpClient ?? http.Client();

  static final ApiClient instance = ApiClient();

  final FirebaseAuth _auth;
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

  Future<Map<String, dynamic>> _get(String path) async {
    final token = await _idToken();
    final uri = Uri.parse('${AppConfig.apiUrl}$path');
    final response = await _http.get(
      uri,
      headers: {
        'Authorization': 'Bearer $token',
        'Accept': 'application/json',
      },
    );

    final payload = _decode(response.body);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        (payload['error'] ?? 'Request failed (${response.statusCode})').toString(),
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
    final payload = await _get('/api/partners');
    final raw = payload['partners'];
    if (raw is! List) {
      return const [];
    }
    return raw
        .whereType<Map>()
        .map((item) => Partner.fromJson(Map<String, dynamic>.from(item)))
        .toList();
  }
}
