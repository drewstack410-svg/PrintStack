import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

class FavoritesRepository {
  FavoritesRepository({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  }) : _firestore = firestore ?? FirebaseFirestore.instance,
       _auth = auth ?? FirebaseAuth.instance;

  static final FavoritesRepository instance = FavoritesRepository();

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  Stream<Set<String>> watchFavoriteShopIds() {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      return Stream.value(const {});
    }

    return _firestore.collection('users').doc(uid).snapshots().map((snapshot) {
      final raw = snapshot.data()?['favoriteShopIds'];
      if (raw is! List) {
        return <String>{};
      }
      return raw.map((id) => id.toString()).where((id) => id.isNotEmpty).toSet();
    });
  }

  Future<void> setFavorite(String partnerId, {required bool favorite}) async {
    final uid = _auth.currentUser?.uid;
    final id = partnerId.trim();
    if (uid == null || uid.isEmpty || id.isEmpty) {
      return;
    }

    await _firestore.collection('users').doc(uid).set({
      'favoriteShopIds': favorite
          ? FieldValue.arrayUnion([id])
          : FieldValue.arrayRemove([id]),
      'updatedAt': FieldValue.serverTimestamp(),
    }, SetOptions(merge: true));
  }
}
