import 'package:cloud_firestore/cloud_firestore.dart';

class PrintOrderDocument {
  const PrintOrderDocument({
    required this.id,
    required this.documentName,
    required this.paperSizeName,
    required this.copies,
    required this.pages,
    required this.bwPages,
    required this.colorPages,
    required this.colorMode,
    required this.totalPrice,
    this.fileUrl = '',
    this.status = '',
  });

  final String id;
  final String documentName;
  final String paperSizeName;
  final int copies;
  final int pages;
  final int bwPages;
  final int colorPages;
  final String colorMode;
  final double totalPrice;
  final String fileUrl;
  final String status;

  factory PrintOrderDocument.fromMap(Map<String, dynamic> data, [int index = 0]) {
    return PrintOrderDocument(
      id: (data['id'] ?? 'doc-${index + 1}').toString(),
      documentName: (data['documentName'] ?? 'Document').toString(),
      paperSizeName: (data['paperSizeName'] ?? '').toString(),
      copies: (data['copies'] as num?)?.toInt() ?? 1,
      pages: (data['pages'] as num?)?.toInt() ?? 1,
      bwPages: (data['bwPages'] as num?)?.toInt() ?? 0,
      colorPages: (data['colorPages'] as num?)?.toInt() ?? 0,
      colorMode: (data['colorMode'] ?? 'bw').toString(),
      totalPrice: (data['totalPrice'] as num?)?.toDouble() ?? 0,
      fileUrl: (data['fileUrl'] ?? '').toString(),
      status: (data['status'] ?? '').toString(),
    );
  }
}

class PrintJob {
  const PrintJob({
    required this.id,
    required this.partnerId,
    required this.orderNumber,
    required this.documentName,
    required this.documentCount,
    required this.documents,
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
  final String orderNumber;
  final String documentName;
  final int documentCount;
  final List<PrintOrderDocument> documents;
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

    final rawDocs = data['documents'];
    final documents = <PrintOrderDocument>[];
    if (rawDocs is List) {
      for (var i = 0; i < rawDocs.length; i++) {
        final item = rawDocs[i];
        if (item is Map) {
          documents.add(
            PrintOrderDocument.fromMap(Map<String, dynamic>.from(item), i),
          );
        }
      }
    }

    if (documents.isEmpty && (data['documentName'] != null || data['fileUrl'] != null)) {
      documents.add(
        PrintOrderDocument.fromMap({
          'id': 'doc-1',
          'documentName': data['documentName'],
          'paperSizeName': data['paperSizeName'],
          'copies': data['copies'],
          'pages': data['pages'],
          'bwPages': data['bwPages'],
          'colorPages': data['colorPages'],
          'colorMode': data['colorMode'],
          'totalPrice': data['totalPrice'],
          'fileUrl': data['fileUrl'],
          'status': data['status'],
        }),
      );
    }

    final pages = documents.fold<int>(0, (sum, d) => sum + d.pages);
    final bwPages = documents.fold<int>(0, (sum, d) => sum + d.bwPages);
    final colorPages = documents.fold<int>(0, (sum, d) => sum + d.colorPages);
    final copies = documents.fold<int>(0, (sum, d) => sum + d.copies);
    final totalPrice = documents.fold<double>(0, (sum, d) => sum + d.totalPrice);
    final first = documents.isEmpty ? null : documents.first;
    final orderNumber = (data['orderNumber'] ?? doc.id).toString().padLeft(8, '0');

    return PrintJob(
      id: doc.id,
      partnerId: partnerId,
      orderNumber: orderNumber.length > 8 ? orderNumber.substring(orderNumber.length - 8) : orderNumber,
      documentName: documents.length <= 1
          ? (first?.documentName ?? (data['documentName'] ?? 'Print order').toString())
          : '${first?.documentName ?? 'Document'} +${documents.length - 1} more',
      documentCount: documents.isEmpty ? 1 : documents.length,
      documents: documents,
      status: (data['status'] ?? 'queued').toString(),
      paperSizeName: first?.paperSizeName ?? (data['paperSizeName'] ?? '').toString(),
      copies: copies > 0 ? copies : ((data['copies'] as num?)?.toInt() ?? 1),
      pages: pages > 0 ? pages : ((data['pages'] as num?)?.toInt() ?? 1),
      bwPages: bwPages > 0 ? bwPages : ((data['bwPages'] as num?)?.toInt() ?? 0),
      colorPages: colorPages > 0
          ? colorPages
          : ((data['colorPages'] as num?)?.toInt() ?? 0),
      colorMode: (data['colorMode'] ?? first?.colorMode ?? 'bw').toString(),
      totalPrice: totalPrice > 0
          ? totalPrice
          : ((data['totalPrice'] as num?)?.toDouble() ?? 0),
      partnerName: partnerName,
      createdAt: createdAt,
    );
  }
}
