import 'package:flutter/material.dart';

import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/common/status_chip.dart';
import '../models/print_job.dart';
import '../services/print_jobs_repository.dart';
import '../theme.dart';

class HistoryPage extends StatelessWidget {
  const HistoryPage({super.key});

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
          itemBuilder: (context, index) => _HistoryTile(job: jobs[index]),
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.job});

  final PrintJob job;

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
    final active = job.status == 'printing' ||
        job.status == 'queued' ||
        job.status == 'sending';

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
            child: const Icon(Icons.picture_as_pdf_outlined, color: AppColors.purple),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  job.documentName,
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
                    if (job.paperSizeName.isNotEmpty) job.paperSizeName,
                    '×${job.copies}',
                    _modeLabel,
                  ].join(' · '),
                  style: const TextStyle(color: AppColors.muted, fontSize: 13),
                ),
                if (_when.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    _when,
                    style: const TextStyle(color: AppColors.muted, fontSize: 12),
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
                label: job.status,
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
            ],
          ),
        ],
      ),
    );
  }
}
