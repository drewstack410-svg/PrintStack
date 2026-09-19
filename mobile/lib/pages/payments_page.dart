import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/common/status_chip.dart';
import '../theme.dart';

class PaymentsPage extends StatefulWidget {
  const PaymentsPage({super.key});

  @override
  State<PaymentsPage> createState() => _PaymentsPageState();
}

class _PaymentsPageState extends State<PaymentsPage> {
  late Future<List<Map<String, dynamic>>> _payments;

  @override
  void initState() {
    super.initState();
    _reload();
  }

  void _reload() {
    _payments = ApiClient.instance.listMyPrintOrderPayments();
  }

  Future<void> _refresh() async {
    setState(_reload);
    await _payments;
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<List<Map<String, dynamic>>>(
      future: _payments,
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
                message: 'Could not load payments.\n\n${snapshot.error}',
              ),
            ],
          );
        }

        final payments = snapshot.data ?? const [];
        if (payments.isEmpty) {
          return RefreshIndicator(
            onRefresh: _refresh,
            child: ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              padding: const EdgeInsets.all(20),
              children: const [
                EmptyState(
                  icon: Icons.payments_outlined,
                  title: 'No payments yet',
                  message: 'Payments for your print orders will appear here.',
                ),
              ],
            ),
          );
        }

        return RefreshIndicator(
          onRefresh: _refresh,
          child: ListView.separated(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            itemCount: payments.length,
            separatorBuilder: (_, _) => const SizedBox(height: 12),
            itemBuilder: (context, index) =>
                _PaymentTile(payment: payments[index]),
          ),
        );
      },
    );
  }
}

class _PaymentTile extends StatelessWidget {
  const _PaymentTile({required this.payment});

  final Map<String, dynamic> payment;

  @override
  Widget build(BuildContext context) {
    final status = (payment['paymentStatus'] ?? 'pending').toString();
    final orderNumber = (payment['orderNumber'] ?? '').toString();
    final partnerName = (payment['partnerName'] ?? '').toString();
    final method = (payment['paymentMethodType'] ?? '').toString();
    final amount = (payment['amount'] as num?)?.toDouble() ?? 0;
    final createdAt = DateTime.tryParse(
      (payment['createdAt'] ?? '').toString(),
    )?.toLocal();
    final date = createdAt == null
        ? ''
        : '${createdAt.month}/${createdAt.day}/${createdAt.year}';

    return Container(
      padding: const EdgeInsets.all(16),
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
                  orderNumber.isEmpty ? 'Print order' : 'Order #$orderNumber',
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                  ),
                ),
                if (partnerName.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    partnerName,
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                    ),
                  ),
                ],
                if (method.isNotEmpty || date.isNotEmpty) ...[
                  const SizedBox(height: 4),
                  Text(
                    [
                      if (method.isNotEmpty) method.toUpperCase(),
                      date,
                    ].where((value) => value.isNotEmpty).join(' · '),
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
                label: status == 'paid'
                    ? 'Paid'
                    : status == 'failed'
                    ? 'Failed'
                    : 'Pending',
                active: status == 'paid',
              ),
              const SizedBox(height: 8),
              Text(
                '₱${amount.toStringAsFixed(2)}',
                style: const TextStyle(
                  fontWeight: FontWeight.w800,
                  color: AppColors.purpleDark,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
