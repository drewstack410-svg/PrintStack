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

  factory Partner.fromJson(Map<String, dynamic> json) {
    final locationJson = json['location'];
    return Partner(
      id: (json['id'] ?? '').toString(),
      companyName: (json['companyName'] ?? '').toString(),
      email: (json['email'] ?? '').toString(),
      logoUrl: (json['logoUrl'] ?? '').toString(),
      location: locationJson is Map<String, dynamic>
          ? PartnerLocation.fromJson(locationJson)
          : null,
    );
  }
}

class PartnerLocation {
  const PartnerLocation({
    required this.lat,
    required this.lng,
    required this.label,
    required this.online,
  });

  final double lat;
  final double lng;
  final String label;
  final bool online;

  factory PartnerLocation.fromJson(Map<String, dynamic> json) {
    return PartnerLocation(
      lat: (json['lat'] as num?)?.toDouble() ?? 0,
      lng: (json['lng'] as num?)?.toDouble() ?? 0,
      label: (json['label'] ?? '').toString(),
      online: json['online'] == true,
    );
  }
}
