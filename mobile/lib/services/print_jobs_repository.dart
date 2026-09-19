import 'dart:async';

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';

import '../models/print_job.dart';

class PrintJobsRepository {
  PrintJobsRepository({FirebaseFirestore? firestore, FirebaseAuth? auth})
    : _firestore = firestore ?? FirebaseFirestore.instance,
      _auth = auth ?? FirebaseAuth.instance;

  static final PrintJobsRepository instance = PrintJobsRepository();

  final FirebaseFirestore _firestore;
  final FirebaseAuth _auth;

  Stream<List<PrintJob>> watchMyJobs({int limit = 40}) {
    final uid = _auth.currentUser?.uid;
    if (uid == null || uid.isEmpty) {
      return Stream.value(const []);
    }

    late StreamController<List<PrintJob>> controller;
    StreamSubscription<QuerySnapshot<Map<String, dynamic>>>? partnersSub;
    final jobSubscriptions =
        <String, StreamSubscription<QuerySnapshot<Map<String, dynamic>>>>{};
    final jobsByPartner = <String, List<PrintJob>>{};
    final partnerNames = <String, String>{};

    void emitJobs() {
      final jobs = jobsByPartner.values.expand((items) => items).toList();
      jobs.sort((a, b) {
        final aTime = a.createdAt?.millisecondsSinceEpoch ?? 0;
        final bTime = b.createdAt?.millisecondsSinceEpoch ?? 0;
        return bTime.compareTo(aTime);
      });
      if (!controller.isClosed) {
        controller.add(jobs.take(limit).toList(growable: false));
      }
    }

    controller = StreamController<List<PrintJob>>(
      onListen: () {
        partnersSub = _firestore.collection('partners').snapshots().listen((
          partnersSnapshot,
        ) {
          final activeIds = partnersSnapshot.docs.map((doc) => doc.id).toSet();

          for (final partnerDoc in partnersSnapshot.docs) {
            final partnerId = partnerDoc.id;
            partnerNames[partnerId] = (partnerDoc.data()['companyName'] ?? '')
                .toString();
            if (jobSubscriptions.containsKey(partnerId)) {
              continue;
            }

            jobSubscriptions[partnerId] = _firestore
                .collection('partners')
                .doc(partnerId)
                .collection('printJobs')
                .where('customerUid', isEqualTo: uid)
                .snapshots()
                .listen((jobsSnapshot) {
                  jobsByPartner[partnerId] = jobsSnapshot.docs
                      .map(
                        (doc) => PrintJob.fromDoc(
                          doc,
                          partnerName: partnerNames[partnerId] ?? '',
                        ),
                      )
                      .toList(growable: false);
                  emitJobs();
                }, onError: controller.addError);
          }

          final removedIds = jobSubscriptions.keys
              .where((id) => !activeIds.contains(id))
              .toList(growable: false);
          for (final partnerId in removedIds) {
            jobSubscriptions.remove(partnerId)?.cancel();
            jobsByPartner.remove(partnerId);
            partnerNames.remove(partnerId);
          }
          emitJobs();
        }, onError: controller.addError);
      },
      onCancel: () async {
        await partnersSub?.cancel();
        await Future.wait(
          jobSubscriptions.values.map((subscription) => subscription.cancel()),
        );
      },
    );

    return controller.stream;
  }
}
