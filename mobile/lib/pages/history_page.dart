import 'package:flutter/material.dart';

import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/common/list_skeleton.dart';
import '../components/common/status_chip.dart';
import '../models/print_job.dart';
import '../services/print_jobs_repository.dart';
import '../theme.dart';
import 'print_job_details_page.dart';

enum _HistoryFilter {
  all,
  active,
  awaitingPayment,
  reservations,
  completed,
  cancelled,
  failed,
}

class HistoryPage extends StatefulWidget {
  const HistoryPage({super.key});

  @override
  State<HistoryPage> createState() => _HistoryPageState();
}

class _HistoryPageState extends State<HistoryPage> {
  _HistoryFilter _filter = _HistoryFilter.all;

  List<PrintJob> _filtered(List<PrintJob> jobs) {
    return jobs
        .where((job) {
          return switch (_filter) {
            _HistoryFilter.all => true,
            _HistoryFilter.active =>
              job.status == 'sending' ||
                  job.status == 'queued' ||
                  job.status == 'reprint_queued' ||
                  job.status == 'printing',
            _HistoryFilter.awaitingPayment => job.status == 'awaiting_payment',
            _HistoryFilter.reservations => job.isReservation,
            _HistoryFilter.completed => job.status == 'printed',
            _HistoryFilter.cancelled => job.status == 'cancelled',
            _HistoryFilter.failed => job.status == 'failed',
          };
        })
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<PrintJob>>(
      stream: PrintJobsRepository.instance.watchMyJobs(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const ListSkeleton();
        }

        if (snapshot.hasError) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ErrorCard(
                message: 'Could not load history.\n\n${snapshot.error}',
              ),
            ],
          );
        }

        final allJobs = snapshot.data ?? const <PrintJob>[];
        final jobs = _filtered(allJobs);

        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
          children: [
            DropdownButtonFormField<_HistoryFilter>(
              initialValue: _filter,
              isDense: true,
              decoration: const InputDecoration(
                labelText: 'Filter history',
                prefixIcon: Icon(Icons.filter_list),
                contentPadding: EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
              ),
              items: const [
                DropdownMenuItem(
                  value: _HistoryFilter.all,
                  child: Text('All orders'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.active,
                  child: Text('Active'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.awaitingPayment,
                  child: Text('Awaiting payment'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.reservations,
                  child: Text('Reservations'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.completed,
                  child: Text('Completed'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.cancelled,
                  child: Text('Cancelled'),
                ),
                DropdownMenuItem(
                  value: _HistoryFilter.failed,
                  child: Text('Failed'),
                ),
              ],
              onChanged: (value) {
                if (value != null) {
                  setState(() => _filter = value);
                }
              },
            ),
            const SizedBox(height: 12),
            Text(
              '${jobs.length} order${jobs.length == 1 ? '' : 's'}',
              style: const TextStyle(
                color: AppColors.muted,
                fontSize: 12,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            if (allJobs.isEmpty)
              const EmptyState(
                icon: Icons.history,
                title: 'No print history yet',
                message: 'Your submitted print orders will appear here.',
              )
            else if (jobs.isEmpty)
              const EmptyState(
                icon: Icons.filter_alt_off_outlined,
                title: 'No matching orders',
                message: 'Choose another history filter.',
              )
            else
              ...jobs.map(
                (job) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: _HistoryTile(
                    job: job,
                    onTap: () => Navigator.of(context).push(
                      MaterialPageRoute<void>(
                        builder: (_) => PrintJobDetailsPage(job: job),
                      ),
                    ),
                  ),
                ),
              ),
          ],
        );
      },
    );
  }
}

class _HistoryTile extends StatelessWidget {
  const _HistoryTile({required this.job, required this.onTap});

  final PrintJob job;
  final VoidCallback onTap;

  String get _statusLabel => switch (job.status) {
    'awaiting_payment' => 'Awaiting payment',
    'sending' => 'Sending',
    'queued' => 'Queued',
    'reprint_queued' => 'Reprint queued',
    'printing' => 'Printing',
    'printed' => 'Printed',
    'failed' => 'Failed',
    'cancelled' => 'Cancelled',
    _ => job.status.isEmpty ? 'Queued' : job.status,
  };

  String get _date {
    final value = job.createdAt?.toLocal();
    if (value == null) return '';
    return '${value.month}/${value.day}/${value.year}';
  }

  @override
  Widget build(BuildContext context) {
    final active =
        job.status == 'sending' ||
        job.status == 'queued' ||
        job.status == 'reprint_queued' ||
        job.status == 'printing';

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(14),
        child: Padding(
          padding: const EdgeInsets.all(13),
          child: Row(
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: AppColors.purple.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(11),
                ),
                child: const Icon(
                  Icons.receipt_long_outlined,
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
                        color: AppColors.navy,
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(
                      [
                        if (job.partnerName.isNotEmpty) job.partnerName,
                        '${job.documentCount} doc${job.documentCount == 1 ? '' : 's'}',
                        if (_date.isNotEmpty) _date,
                      ].join(' · '),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  StatusChip(
                    label: _statusLabel,
                    active: active || job.status == 'printed',
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '₱${job.totalPrice.toStringAsFixed(2)}',
                    style: const TextStyle(
                      color: AppColors.purpleDark,
                      fontSize: 12,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
              const SizedBox(width: 4),
              const Icon(Icons.chevron_right, size: 20, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
