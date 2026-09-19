import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/common/status_chip.dart';
import '../models/print_job.dart';
import '../services/print_jobs_repository.dart';
import '../theme.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

  Future<void> _cancelReservation(BuildContext context, PrintJob job) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel reservation?'),
        content: Text(
          'Cancel reservation #${job.orderNumber}? This cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Keep'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Cancel reservation'),
          ),
        ],
      ),
    );
    if (confirmed != true || !context.mounted) {
      return;
    }

    try {
      final result = await ApiClient.instance.cancelPrintReservation(
        partnerId: job.partnerId,
        printJobId: job.id,
      );
      if (!context.mounted) return;
      final refundReview = result['requiresRefundReview'] == true;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            refundReview
                ? 'Reservation cancelled. The paid order needs refund review.'
                : 'Reservation cancelled.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<PrintJob>>(
      stream: PrintJobsRepository.instance.watchMyJobs(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ErrorCard(
                message:
                    'Could not load history. If this is the first time, create a Firestore collection-group index on printJobs.customerUid.\n\n${snapshot.error}',
              ),
            ],
          );
        }

        final jobs = snapshot.data ?? const <PrintJob>[];
        if (jobs.isEmpty) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: const [
              EmptyState(
                icon: Icons.history,
                title: 'No print history yet',
                message: 'Jobs you send from the Print tab will appear here.',
              ),
            ],
          );
        }

        return ListView.separated(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          itemCount: jobs.length,
          separatorBuilder: (_, _) => const SizedBox(height: 12),
          itemBuilder: (context, index) => _HistoryTile(
            job: jobs[index],
            onCancel: () => _cancelReservation(context, jobs[index]),
          ),
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.job, required this.onCancel});

  final PrintJob job;
  final VoidCallback onCancel;

  String get _modeLabel {
    if (job.bwPages > 0 && job.colorPages > 0) {
      return '${job.bwPages} B&W · ${job.colorPages} color';
    }
    if (job.colorPages > 0 || job.colorMode == 'color') {
      return 'Color';
    }
    return 'B&W';
  }

  String get _when {
    final date = job.createdAt;
    if (date == null) {
      return '';
    }
    return '${date.month}/${date.day}/${date.year} · '
        '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }

  @override
  Widget build(BuildContext context) {
    final active =
        job.status == 'printing' ||
        job.status == 'queued' ||
        job.status == 'sending';
    final statusLabel = switch (job.status) {
      'awaiting_payment' => 'Awaiting payment',
      'sending' => 'Sending',
      'queued' => 'Queued',
      'printing' => 'Printing',
      'printed' => 'Printed',
      'failed' => 'Failed',
      'cancelled' => 'Cancelled',
      _ => job.status.isEmpty ? 'Queued' : job.status,
    };

    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: AppColors.purple.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(
              Icons.picture_as_pdf_outlined,
              color: AppColors.purple,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Order #${job.orderNumber}',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  [
                    if (job.partnerName.isNotEmpty) job.partnerName,
                    '${job.documentCount} doc${job.documentCount == 1 ? '' : 's'}',
                    if (job.documentName.isNotEmpty) job.documentName,
                    '×${job.copies}',
                    _modeLabel,
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                if (job.rawStatus.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    job.rawStatus,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
                if (job.paymentStatus.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    job.paymentStatus == 'paid'
                        ? 'Payment confirmed'
                        : job.paymentStatus == 'failed'
                        ? 'Payment failed'
                        : 'Payment ${job.paymentStatus}',
                    style: TextStyle(
                      color: job.paymentStatus == 'paid'
                          ? Colors.green.shade700
                          : AppColors.muted,
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ],
                if (_when.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _when,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 12,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              StatusChip(
                label: statusLabel,
                active: active || job.status == 'printed',
              ),
              if (job.totalPrice > 0) ...[
                const SizedBox(height: 8),
                Text(
                  '₱${job.totalPrice.toStringAsFixed(2)}',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.purpleDark,
                  ),
                ),
              ],
              if (job.isReservation &&
                  job.status != 'cancelled' &&
                  job.status != 'printing' &&
                  job.status != 'printed') ...[
                const SizedBox(height: 4),
                TextButton(
                  onPressed: onCancel,
                  style: TextButton.styleFrom(
                    foregroundColor: Colors.red.shade700,
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                  ),
                  child: const Text('Cancel'),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }
}
