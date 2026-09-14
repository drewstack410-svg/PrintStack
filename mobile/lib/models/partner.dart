class Partner {
  const Partner({
    required this.id,
    required this.companyName,
    required this.email,
    required this.logoUrl,
    this.location,
  });

  final String id;
  final String companyName;
  final String email;
  final String logoUrl;
  final PartnerLocation? location;

  static const onlineWindow = Duration(minutes: 5);

  factory Partner.fromJson(Map<String, dynamic> json) {
    final locationJson = json['location'];
    return Partner(
      id: (json['id'] ?? '').toString(),
      companyName: (json['companyName'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      logoUrl: (json['logoUrl'] ?? '').toString(),
      location: locationJson is Map
          ? PartnerLocation.fromMap(Map<String, dynamic>.from(locationJson))
          : null,
    );
  }

  factory Partner.fromFirestore(String id, Map<String, dynamic> data) {
    final locationJson = data['location'];
    return Partner(
      id: id,
      companyName: (data['companyName'] ?? '').toString(),
      email: (data['email'] ?? '').toString(),
      logoUrl: (data['logoUrl'] ?? '').toString(),
      location: locationJson is Map
          ? PartnerLocation.fromMap(Map<String, dynamic>.from(locationJson))
          : null,
    );
  }
}

class PartnerLocation {
  const PartnerLocation({
    required this.lat,
    required this.lng,
    required this.label,
    required this.flaggedOnline,
    this.updatedAt,
  });

  final double lat;
  final double lng;
  final String label;
  final bool flaggedOnline;
  final DateTime? updatedAt;

  bool get online {
    if (!flaggedOnline || updatedAt == null) {
      return false;
    }
    return DateTime.now().difference(updatedAt!) <= Partner.onlineWindow;
  }

  factory PartnerLocation.fromMap(Map<String, dynamic> json) {
    return PartnerLocation(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      label: (json['label'] ?? '').toString(),
      flaggedOnline: json['online'] != false,
      updatedAt: _parseDate(json['updatedAt']),
    );
  }

  static DateTime? _parseDate(dynamic value) {
    if (value == null) {
      return null;
    }
    if (value is DateTime) {
      return value;
    }
    if (value is String && value.isNotEmpty) {
      return DateTime.tryParse(value);
    }
    try {
      return value.toDate() as DateTime;
    } catch (_) {
      return null;
    }
  }
}
