import 'package:flutter/material.dart';
import 'package:pdfrx/pdfrx.dart';

import '../api/api_client.dart';
import '../components/buttons/gradient_button.dart';
import '../components/common/status_chip.dart';
import '../models/print_job.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import 'print_order_payment_page.dart';

class PrintJobDetailsPage extends StatefulWidget {
  const PrintJobDetailsPage({super.key, required this.job});

  final PrintJob job;

  @override
  State<PrintJobDetailsPage> createState() => _PrintJobDetailsPageState();
}

class _PrintJobDetailsPageState extends State<PrintJobDetailsPage> {
  bool _cancelling = false;
  bool _requestingReprint = false;
  bool _openingPayment = false;

  String _formatDate(DateTime? value) {
    if (value == null) return '—';
    final local = value.toLocal();
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final period = local.hour >= 12 ? 'PM' : 'AM';
    return '${local.month}/${local.day}/${local.year} · $hour:$minute $period';
  }

  String get _statusLabel => switch (widget.job.status) {
    'awaiting_payment' => 'Awaiting payment',
    'sending' => 'Sending',
    'queued' => 'Queued',
    'reprint_queued' => 'Reprint queued',
    'printing' => 'Printing',
    'printed' => 'Printed',
    'failed' => 'Failed',
    'cancelled' => 'Cancelled',
    _ => widget.job.status.isEmpty ? 'Queued' : widget.job.status,
  };

  bool get _canCancel =>
      widget.job.isReservation &&
      widget.job.status != 'cancelled' &&
      widget.job.status != 'printing' &&
      widget.job.status != 'printed';

  bool get _canReprint =>
      widget.job.status == 'printed' || widget.job.status == 'failed';

  Future<bool> _openPayment({
    required String printJobId,
    required String orderNumber,
    required String amountDisplay,
  }) async {
    final partner = await PartnersRepository.instance
        .watchPartner(widget.job.partnerId)
        .first;
    if (!mounted) return false;
    if (partner == null) {
      throw const ApiException('Could not load the print shop.');
    }

    return await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => PrintOrderPaymentPage(
              partner: partner,
              printJobId: printJobId,
              orderNumber: orderNumber,
              amountDisplay: amountDisplay,
            ),
          ),
        ) ??
        false;
  }

  Future<void> _payCurrentOrder() async {
    setState(() => _openingPayment = true);
    try {
      final paid = await _openPayment(
        printJobId: widget.job.id,
        orderNumber: widget.job.orderNumber,
        amountDisplay: widget.job.totalPrice.toStringAsFixed(2),
      );
      if (!mounted) return;
      if (paid) {
        Navigator.of(context).pop(true);
      } else {
        setState(() => _openingPayment = false);
      }
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _openingPayment = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _requestReprint() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Request reprint?'),
        content: Text(
          'Add order #${widget.job.orderNumber} to the shop’s reprint queue?',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext, false),
            child: const Text('Not now'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(dialogContext, true),
            child: const Text('Request reprint'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    setState(() => _requestingReprint = true);
    try {
      final result = await ApiClient.instance.requestPrintReprint(
        partnerId: widget.job.partnerId,
        printJobId: widget.job.id,
      );
      if (!mounted) return;
      final printJob = result['printJob'] is Map
          ? Map<String, dynamic>.from(result['printJob'] as Map)
          : <String, dynamic>{};
      final printJobId = (printJob['id'] ?? '').toString();
      final orderNumber = (printJob['orderNumber'] ?? '').toString();
      final amount =
          (printJob['totalPrice'] as num?)?.toStringAsFixed(2) ??
          widget.job.totalPrice.toStringAsFixed(2);
      final requiresPayment = result['requiresPayment'] == true;
      if (requiresPayment && printJobId.isNotEmpty) {
        final paid = await _openPayment(
          printJobId: printJobId,
          orderNumber: orderNumber,
          amountDisplay: amount,
        );
        if (!mounted) return;
        if (!paid) {
          setState(() => _requestingReprint = false);
          return;
        }
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            requiresPayment
                ? 'Paid reprint added to the queue.'
                : 'Reprint added to the queue.',
          ),
        ),
      );
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _requestingReprint = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _cancelReservation() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: const Text('Cancel reservation?'),
        content: Text(
          'Cancel reservation #${widget.job.orderNumber}? This cannot be undone.',
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
    if (confirmed != true || !mounted) return;

    setState(() => _cancelling = true);
    try {
      final result = await ApiClient.instance.cancelPrintReservation(
        partnerId: widget.job.partnerId,
        printJobId: widget.job.id,
      );
      if (!mounted) return;
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
      Navigator.of(context).pop(true);
    } on ApiException catch (error) {
      if (!mounted) return;
      setState(() => _cancelling = false);
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  void _openPreview(PrintOrderDocument document) {
    final uri = Uri.tryParse(document.fileUrl);
    if (uri == null || !uri.hasScheme) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Preview is not available for this file.'),
        ),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => _DocumentPreviewPage(document: document),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final job = widget.job;
    final paymentLabel = job.paymentStatus.isEmpty
        ? 'Not required'
        : job.paymentStatus == 'paid'
        ? 'Paid'
        : job.paymentStatus[0].toUpperCase() + job.paymentStatus.substring(1);

    return Scaffold(
      backgroundColor: AppColors.mist,
      appBar: AppBar(title: Text('Order #${job.orderNumber}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        job.partnerName.isEmpty
                            ? 'Print shop'
                            : job.partnerName,
                        style: const TextStyle(
                          color: AppColors.navy,
                          fontSize: 18,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      if (job.rawStatus.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Text(
                          job.rawStatus,
                          style: const TextStyle(color: AppColors.muted),
                        ),
                      ],
                    ],
                  ),
                ),
                StatusChip(
                  label: _statusLabel,
                  active:
                      job.status == 'queued' ||
                      job.status == 'printing' ||
                      job.status == 'printed',
                ),
              ],
            ),
          ),
          const SizedBox(height: 12),
          _DetailsCard(
            children: [
              _DetailRow(
                label: 'Order type',
                value: job.isReservation ? 'Reserved printing' : 'Print order',
              ),
              _DetailRow(label: 'Submitted', value: _formatDate(job.createdAt)),
              _DetailRow(
                label: 'Claim schedule',
                value: _formatDate(job.claimAt),
              ),
              _DetailRow(label: 'Payment', value: paymentLabel),
              _DetailRow(
                label: 'Total',
                value: '₱${job.totalPrice.toStringAsFixed(2)}',
                isLast: true,
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            'Documents (${job.documents.length})',
            style: const TextStyle(
              color: AppColors.navy,
              fontSize: 16,
              fontWeight: FontWeight.w900,
            ),
          ),
          const SizedBox(height: 10),
          ...job.documents.map(
            (document) => Padding(
              padding: const EdgeInsets.only(bottom: 10),
              child: GestureDetector(
                onTap: document.fileUrl.isEmpty
                    ? null
                    : () => _openPreview(document),
                child: Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _DocumentThumbnail(
                        document: document,
                        onTap: () => _openPreview(document),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              document.documentName,
                              style: const TextStyle(
                                color: AppColors.navy,
                                fontWeight: FontWeight.w800,
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              [
                                if (document.paperSizeName.isNotEmpty)
                                  document.paperSizeName,
                                '${document.pages} page${document.pages == 1 ? '' : 's'}',
                                '×${document.copies}',
                                document.colorMode == 'color'
                                    ? 'Color'
                                    : document.colorMode == 'mixed'
                                    ? 'Mixed'
                                    : 'B&W',
                              ].join(' · '),
                              style: const TextStyle(
                                color: AppColors.muted,
                                fontSize: 12,
                              ),
                            ),
                            if (document.fileUrl.isNotEmpty) ...[
                              const SizedBox(height: 5),
                              const Text(
                                'Tap card to preview',
                                style: TextStyle(
                                  color: AppColors.purple,
                                  fontSize: 11,
                                  fontWeight: FontWeight.w700,
                                ),
                              ),
                            ],
                          ],
                        ),
                      ),
                      Text(
                        '₱${document.totalPrice.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: AppColors.purpleDark,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
          if (_canReprint) ...[
            const SizedBox(height: 8),
            GradientButton(
              label: 'Request reprint',
              busy: _requestingReprint,
              onPressed: _requestingReprint ? null : _requestReprint,
            ),
          ],
          if (job.status == 'awaiting_payment') ...[
            const SizedBox(height: 8),
            GradientButton(
              label: 'Pay now',
              busy: _openingPayment,
              onPressed: _openingPayment ? null : _payCurrentOrder,
            ),
          ],
          if (_canCancel) ...[
            const SizedBox(height: 8),
            GradientButton(
              label: 'Cancel reservation',
              busy: _cancelling,
              onPressed: _cancelling ? null : _cancelReservation,
            ),
          ],
        ],
      ),
    );
  }
}

class _DocumentThumbnail extends StatelessWidget {
  const _DocumentThumbnail({required this.document, required this.onTap});

  final PrintOrderDocument document;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final uri = Uri.tryParse(document.fileUrl);
    final canPreview = uri != null && uri.hasScheme;

    return Material(
      color: const Color(0xFFE8ECF4),
      borderRadius: BorderRadius.circular(8),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: canPreview ? onTap : null,
        child: SizedBox(
          width: 58,
          height: 76,
          child: canPreview
              ? IgnorePointer(
                  child: PdfViewer.uri(
                    uri,
                    initialPageNumber: 1,
                    params: const PdfViewerParams(
                      margin: 0,
                      backgroundColor: Color(0xFFE8ECF4),
                    ),
                  ),
                )
              : const Icon(
                  Icons.picture_as_pdf_outlined,
                  color: AppColors.purple,
                  size: 30,
                ),
        ),
      ),
    );
  }
}

class _DocumentPreviewPage extends StatelessWidget {
  const _DocumentPreviewPage({required this.document});

  final PrintOrderDocument document;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFE8ECF4),
      appBar: AppBar(
        title: Text(
          document.documentName,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
        ),
      ),
      body: PdfViewer.uri(
        Uri.parse(document.fileUrl),
        params: const PdfViewerParams(
          margin: 12,
          backgroundColor: Color(0xFFE8ECF4),
        ),
      ),
    );
  }
}

class _DetailsCard extends StatelessWidget {
  const _DetailsCard({required this.children});

  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(children: children),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.label,
    required this.value,
    this.isLast = false,
  });

  final String label;
  final String value;
  final bool isLast;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 13),
      decoration: BoxDecoration(
        border: isLast
            ? null
            : const Border(bottom: BorderSide(color: Color(0xFFE8EAF0))),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: AppColors.muted, fontSize: 13),
            ),
          ),
          const SizedBox(width: 16),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.right,
              style: const TextStyle(
                color: AppColors.navy,
                fontWeight: FontWeight.w800,
                fontSize: 13,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
