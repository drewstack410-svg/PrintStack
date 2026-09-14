import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/print_job.dart';

class PrintJobsRepository {
  PrintJobsRepository({
    FirebaseFirestore? firestore,
    FirebaseAuth? auth,
  })  : _firestore = firestore ?? FirebaseFirestore.instance,
        _auth = auth ?? FirebaseAuth.instance;

  static final PrintJobsRepository instance = PrintJobsRepository();

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  Stream<List<PrintJob>> watchMyJobs({int limit = 40}) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      return Stream.value(const []);
    }

    Query<Map<String, dynamic>> query = _firestore
        .collectionGroup('printJobs')
        .where('customerUid', isEqualTo: uid)
        .limit(limit);

    return query.snapshots().asyncMap((snapshot) async {
      final partnerNames = <String, String>{};
      final jobs = <PrintJob>[];

      for (final doc in snapshot.docs) {
        final pathParts = doc.reference.path.split('/');
        final partnerId = pathParts.length >= 2 ? pathParts[1] : '';
        if (partnerId.isNotEmpty && !partnerNames.containsKey(partnerId)) {
          try {
            final partnerSnap =
                await _firestore.collection('partners').doc(partnerId).get();
            partnerNames[partnerId] =
                (partnerSnap.data()?['companyName'] ?? '').toString();
          } catch (_) {
            partnerNames[partnerId] = '';
          }
        }

        jobs.add(
          PrintJob.fromDoc(
            doc,
            partnerName: partnerNames[partnerId] ?? '',
          ),
        );
      }

      jobs.sort((a, b) {
        final aTime = a.createdAt?.millisecondsSinceEpoch ?? 0;
        final bTime = b.createdAt?.millisecondsSinceEpoch ?? 0;
        return bTime.compareTo(aTime);
      });
      return jobs;
    });
  }
}
