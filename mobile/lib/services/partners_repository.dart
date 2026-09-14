import 'package:cloud_firestore/cloud_firestore.dart';

import '../models/partner.dart';

class PartnersRepository {
  PartnersRepository({FirebaseFirestore? firestore})
    : _firestore = firestore ?? FirebaseFirestore.instance;

  static final PartnersRepository instance = PartnersRepository();

  final FirebaseFirestore _firestore;

  Stream<List<Partner>> watchPartners() {
    return _firestore.collection('partners').snapshots().map((snapshot) {
      final partners = snapshot.docs
          .map((doc) => Partner.fromFirestore(doc.id, doc.data()))
          .toList();
      partners.sort((a, b) {
        final aOnline = a.location?.online == true ? 0 : 1;
        final bOnline = b.location?.online == true ? 0 : 1;
        if (aOnline != bOnline) {
          return aOnline.compareTo(bOnline);
        }
        return a.companyName.toLowerCase().compareTo(b.companyName.toLowerCase());
      });
      return partners;
    });
  }
}
