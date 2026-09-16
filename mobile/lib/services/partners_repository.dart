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

  /// Realtime stream of partners that are currently online with printing enabled.
  Stream<List<Partner>> watchOnlinePartners() {
    return watchPartners().map(
      (partners) => partners
          .where(
            (p) => p.location?.online == true && p.services.printing,
          )
          .toList(growable: false),
    );
  }

  Stream<Partner?> watchPartner(String partnerId) {
    final id = partnerId.trim();
    if (id.isEmpty) {
      return Stream.value(null);
    }
    return _firestore.collection('partners').doc(id).snapshots().map((snap) {
      if (!snap.exists) {
        return null;
      }
      return Partner.fromFirestore(snap.id, snap.data()!);
    });
  }
}
