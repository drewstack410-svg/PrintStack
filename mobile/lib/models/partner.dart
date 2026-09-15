class PaperSize {
  const PaperSize({
    required this.id,
    required this.name,
    required this.width,
    required this.height,
    required this.unit,
    required this.priceBw,
    required this.priceColor,
  });

  final String id;
  final String name;
  final double width;
  final double height;
  final String unit;
  final double priceBw;
  final double priceColor;

  double get pricePerPiece => priceBw;

  double priceFor({required bool color}) => color ? priceColor : priceBw;

  factory PaperSize.fromMap(Map<String, dynamic> json, [String fallbackId = '']) {
    final legacy = (json['pricePerPiece'] as num?)?.toDouble() ?? 0;
    final priceBw = (json['priceBw'] as num?)?.toDouble() ?? legacy;
    final priceColor = (json['priceColor'] as num?)?.toDouble() ?? mathMax(legacy, priceBw);

    return PaperSize(
      id: (json['id'] ?? fallbackId).toString(),
      name: (json['name'] ?? '').toString(),
      width: (json['width'] as num?)?.toDouble() ?? 0,
      height: (json['height'] as num?)?.toDouble() ?? 0,
      unit: (json['unit'] ?? 'mm').toString(),
      priceBw: priceBw,
      priceColor: priceColor,
    );
  }

  static double mathMax(double a, double b) => a > b ? a : b;

  String get sizeLabel {
    final w = width % 1 == 0 ? width.toInt().toString() : width.toString();
    final h = height % 1 == 0 ? height.toInt().toString() : height.toString();
    return '$w × $h $unit';
  }

  static const defaults = [
    PaperSize(
      id: 'letter',
      name: 'Letter',
      width: 8.5,
      height: 11,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'tabloid',
      name: 'Tabloid',
      width: 11,
      height: 17,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'legal',
      name: 'Legal',
      width: 8.5,
      height: 14,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'statement',
      name: 'Statement',
      width: 5.5,
      height: 8.5,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'executive',
      name: 'Executive',
      width: 7.25,
      height: 10.5,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'a3',
      name: 'A3',
      width: 11.69,
      height: 16.54,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'a4',
      name: 'A4',
      width: 8.27,
      height: 11.69,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'a5',
      name: 'A5',
      width: 5.83,
      height: 8.27,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'b4-jis',
      name: 'B4 (JIS)',
      width: 10.12,
      height: 14.33,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'b5-jis',
      name: 'B5 (JIS)',
      width: 7.17,
      height: 10.12,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'envelope-9',
      name: 'Envelope #9',
      width: 3.875,
      height: 8.875,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'envelope-10',
      name: 'Envelope #10',
      width: 4.125,
      height: 9.5,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
    PaperSize(
      id: 'c-size',
      name: 'C size sheet',
      width: 17,
      height: 22,
      unit: 'in',
      priceBw: 0,
      priceColor: 0,
    ),
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
