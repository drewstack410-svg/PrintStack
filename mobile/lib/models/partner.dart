class PaperSize {
  const PaperSize({
    required this.id,
    required this.name,
    required this.width,
    required this.height,
    required this.unit,
    required this.pricePerPiece,
  });

  final String id;
  final String name;
  final double width;
  final double height;
  final String unit;
  final double pricePerPiece;

  factory PaperSize.fromMap(Map<String, dynamic> json, [String fallbackId = '']) {
    return PaperSize(
      id: (json['id'] ?? fallbackId).toString(),
      name: (json['name'] ?? '').toString(),
      width: (json['width'] as num?)?.toDouble() ?? 0,
      height: (json['height'] as num?)?.toDouble() ?? 0,
      unit: (json['unit'] ?? 'mm').toString(),
      pricePerPiece: (json['pricePerPiece'] as num?)?.toDouble() ?? 0,
    );
  }

  String get sizeLabel {
    final w = width % 1 == 0 ? width.toInt().toString() : width.toString();
    final h = height % 1 == 0 ? height.toInt().toString() : height.toString();
    return '$w × $h $unit';
  }

  static const defaults = [
    PaperSize(id: 'a4', name: 'A4', width: 210, height: 297, unit: 'mm', pricePerPiece: 0),
    PaperSize(id: 'a3', name: 'A3', width: 297, height: 420, unit: 'mm', pricePerPiece: 0),
    PaperSize(id: 'a5', name: 'A5', width: 148, height: 210, unit: 'mm', pricePerPiece: 0),
    PaperSize(id: 'short', name: 'Short', width: 8.5, height: 11, unit: 'in', pricePerPiece: 0),
    PaperSize(id: 'long', name: 'Long', width: 8.5, height: 13, unit: 'in', pricePerPiece: 0),
  ];
}

class Partner {
  const Partner({
    required this.id,
    required this.companyName,
    required this.email,
    required this.logoUrl,
    this.location,
    this.paperSizes = const [],
  });

  final String id;
  final String companyName;
  final String email;
  final String logoUrl;
  final PartnerLocation? location;
  final List<PaperSize> paperSizes;

  static const onlineWindow = Duration(minutes: 5);

  factory Partner.fromJson(Map<String, dynamic> json) {
    return Partner._from(json['id']?.toString() ?? '', json);
  }

  factory Partner.fromFirestore(String id, Map<String, dynamic> data) {
    return Partner._from(id, data);
  }

  factory Partner._from(String id, Map<String, dynamic> data) {
    final locationJson = data['location'];
    final sizesRaw = data['paperSizes'];
    final paperSizes = <PaperSize>[];
    if (sizesRaw is List) {
      for (var i = 0; i < sizesRaw.length; i++) {
        final item = sizesRaw[i];
        if (item is Map) {
          paperSizes.add(
            PaperSize.fromMap(Map<String, dynamic>.from(item), 'size-${i + 1}'),
          );
        }
      }
    }

    return Partner(
      id: id,
      companyName: (data['companyName'] ?? '').toString(),
      email: (data['email'] ?? '').toString(),
      logoUrl: (data['logoUrl'] ?? '').toString(),
      location: locationJson is Map
          ? PartnerLocation.fromMap(Map<String, dynamic>.from(locationJson))
          : null,
      paperSizes: paperSizes.isEmpty ? PaperSize.defaults : paperSizes,
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
