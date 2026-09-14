import 'package:cloud_firestore/cloud_firestore.dart';

class PrintJob {
  const PrintJob({
    required this.id,
    required this.partnerId,
    required this.documentName,
    required this.status,
    required this.paperSizeName,
    required this.copies,
    required this.pages,
    required this.bwPages,
    required this.colorPages,
    required this.colorMode,
    required this.totalPrice,
    required this.partnerName,
    this.createdAt,
  });

  final String id;
  final String partnerId;
  final String documentName;
  final String status;
  final String paperSizeName;
  final int copies;
  final int pages;
  final int bwPages;
  final int colorPages;
  final String colorMode;
  final double totalPrice;
  final String partnerName;
  final DateTime? createdAt;

  factory PrintJob.fromDoc(
    QueryDocumentSnapshot<Map<String, dynamic>> doc, {
    String partnerName = '',
  }) {
    final data = doc.data();
    final pathParts = doc.reference.path.split('/');
    final partnerId = pathParts.length >= 2 ? pathParts[1] : '';

    DateTime? createdAt;
    final rawCreated = data['createdAt'];
    if (rawCreated is Timestamp) {
      createdAt = rawCreated.toDate();
    }

    final pages = (data['pages'] as num?)?.toInt() ?? 1;
    final bwPages = (data['bwPages'] as num?)?.toInt() ?? 0;
    final colorPages = (data['colorPages'] as num?)?.toInt() ?? 0;

    return PrintJob(
      id: doc.id,
      partnerId: partnerId,
      documentName: (data['documentName'] ?? 'Print job').toString(),
      status: (data['status'] ?? 'queued').toString(),
      paperSizeName: (data['paperSizeName'] ?? '').toString(),
      copies: (data['copies'] as num?)?.toInt() ?? 1,
      pages: pages,
      bwPages: bwPages,
      colorPages: colorPages,
      colorMode: (data['colorMode'] ?? 'bw').toString(),
      totalPrice: (data['totalPrice'] as num?)?.toDouble() ?? 0,
      partnerName: partnerName,
      createdAt: createdAt,
    );
  }
}
