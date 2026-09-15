import 'dart:io';

import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../components/buttons/gradient_button.dart';
import '../components/common/empty_state.dart';
import '../components/common/message_banner.dart';
import '../models/partner.dart';
import '../models/print_draft_document.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import 'partner_order_page.dart';
import 'print_order_payment_page.dart';

/// Staging list of papers to print. Upload + order only happen when Print is tapped.
class PrintQueuePage extends StatefulWidget {
  const PrintQueuePage({
    super.key,
    required this.partner,
    required this.documents,
  });

  final Partner partner;
  final List<PrintDraftDocument> documents;

  @override
  State<PrintQueuePage> createState() => _PrintQueuePageState();
}

class _PrintQueuePageState extends State<PrintQueuePage> {
  late List<PrintDraftDocument> _documents;
  late final Stream<Partner?> _partnerStream;
  Partner? _livePartner;
  bool _printing = false;
  String? _error;
  String? _success;

  @override
  void initState() {
    super.initState();
    _documents = List<PrintDraftDocument>.from(widget.documents);
    _livePartner = widget.partner;
    _partnerStream = PartnersRepository.instance.watchPartner(widget.partner.id);
  }

  bool get _shopOnline => _livePartner?.location?.online == true;

  double get _orderTotal =>
      _documents.fold<double>(0, (sum, doc) => sum + doc.lineTotal);

  void _removeAt(int index) {
    setState(() {
      _documents.removeAt(index);
      _error = null;
      _success = null;
    });
  }

  Future<void> _addMore() async {
    final added = await Navigator.of(context).push<PrintDraftDocument>(
      MaterialPageRoute(
        builder: (_) => PartnerOrderPage(
          partner: widget.partner,
          returnDocumentOnly: true,
        ),
      ),
    );

    if (!mounted || added == null) {
      return;
    }

    setState(() {
      _documents.add(added);
      _error = null;
      _success = null;
    });
  }

  Future<void> _print() async {
    if (_documents.isEmpty) {
      setState(() => _error = 'Add at least one document to print.');
      return;
    }
    if (!_shopOnline) {
      setState(
        () => _error =
            'This shop went offline. You can’t submit until they are online again.',
      );
      return;
    }

    setState(() {
      _printing = true;
      _error = null;
      _success = null;
    });

    try {
      final payloads = <Map<String, dynamic>>[];
      for (final doc in _documents) {
        final upload = await ApiClient.instance.uploadPrintPdf(
          partnerId: widget.partner.id,
          file: File(doc.path),
          fileName: doc.fileName,
        );
        payloads.add({
          'documentName': doc.fileName,
          'fileUrl': upload.fileUrl,
          'filePath': upload.filePath,
          'paperSizeId': doc.paperSize.id,
          'copies': doc.copies,
          'pages': doc.totalPages,
          'bwPages': doc.bwPages,
          'colorPages': doc.colorPages,
        });
      }

      final result = await ApiClient.instance.createCustomerPrintOrder(
        partnerId: widget.partner.id,
        documents: payloads,
      );

      if (!mounted) {
        return;
      }

      final printJob = result['printJob'] is Map
          ? Map<String, dynamic>.from(result['printJob'] as Map)
          : <String, dynamic>{};
      final orderNumber =
          (printJob['orderNumber'] ?? result['orderNumber'])?.toString() ?? '';
      final printJobId = (printJob['id'] ?? '').toString();
      final requiresPayment = result['requiresPayment'] == true;
      final amountDisplay =
          (printJob['totalPrice'] as num?)?.toStringAsFixed(2) ??
          _orderTotal.toStringAsFixed(2);

      if (requiresPayment && printJobId.isNotEmpty) {
        setState(() => _printing = false);
        final paid = await Navigator.of(context).push<bool>(
          MaterialPageRoute(
            builder: (_) => PrintOrderPaymentPage(
              partner: widget.partner,
              printJobId: printJobId,
              orderNumber: orderNumber,
              amountDisplay: amountDisplay,
              documents: List<PrintDraftDocument>.from(_documents),
            ),
          ),
        );
        if (!mounted) return;
        if (paid == true) {
          setState(() => _documents.clear());
          Navigator.of(context).pop();
        } else {
          setState(() {
            _error =
                'Payment was not completed. Your order is held until you pay.';
          });
        }
        return;
      }

      final message = orderNumber.isEmpty
          ? 'Order submitted · ${_documents.length} document${_documents.length == 1 ? '' : 's'}.'
          : 'Order #$orderNumber submitted · ${_documents.length} document${_documents.length == 1 ? '' : 's'}.';

      setState(() {
        _success = message;
        _documents.clear();
      });

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(message)),
      );
      Navigator.of(context).pop();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } catch (error) {
      if (mounted) {
        setState(() => _error = error.toString());
      }
    } finally {
      if (mounted) {
        setState(() => _printing = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final shopName =
        widget.partner.companyName.isEmpty ? 'Shop' : widget.partner.companyName;

    return StreamBuilder<Partner?>(
      stream: _partnerStream,
      builder: (context, snapshot) {
        if (snapshot.hasData) {
          _livePartner = snapshot.data;
        }
        final online = _shopOnline;

        return Scaffold(
          backgroundColor: AppColors.mist,
          appBar: AppBar(
            title: const Text('Papers to print'),
          ),
          body: Column(
            children: [
              if (!online)
                const Padding(
                  padding: EdgeInsets.fromLTRB(16, 12, 16, 0),
                  child: MessageBanner(
                    message:
                        'This shop is offline. Submitting is disabled until they come back online.',
                    isError: true,
                  ),
                ),
              Expanded(
                child: _documents.isEmpty
                    ? const Padding(
                        padding: EdgeInsets.all(16),
                        child: EmptyState(
                          icon: Icons.print_outlined,
                          title: 'Nothing to print yet',
                          message: 'Add a document to build your print list.',
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
                        children: [
                          Text(
                            'These papers will be printed at $shopName. Add more if you need, then tap Print.',
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 14,
                              height: 1.35,
                            ),
                          ),
                          const SizedBox(height: 14),
                          ...List.generate(_documents.length, (index) {
                            final doc = _documents[index];
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 10),
                              child: _QueueDocCard(
                                doc: doc,
                                onRemove:
                                    _printing ? null : () => _removeAt(index),
                              ),
                            );
                          }),
                        ],
                      ),
              ),
              if (_error != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: MessageBanner(message: _error!, isError: true),
                ),
              if (_success != null)
                Padding(
                  padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
                  child: MessageBanner(message: _success!),
                ),
              Material(
                elevation: 12,
                color: Colors.white,
                shadowColor: Colors.black38,
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(16, 12, 16, 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _documents.isEmpty
                                    ? 'Estimated total'
                                    : 'Order · ${_documents.length} doc${_documents.length == 1 ? '' : 's'}',
                                style: const TextStyle(
                                  color: AppColors.muted,
                                  fontSize: 12,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                              const SizedBox(height: 2),
                              Text(
                                '₱${_orderTotal.toStringAsFixed(2)}',
                                style: const TextStyle(
                                  fontSize: 22,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.purple,
                                ),
                              ),
                            ],
                          ),
                        ),
                        OutlinedButton(
                          onPressed: _printing ? null : _addMore,
                          style: OutlinedButton.styleFrom(
                            minimumSize: const Size(0, 48),
                            padding:
                                const EdgeInsets.symmetric(horizontal: 16),
                          ),
                          child: const Text('Add more'),
                        ),
                        const SizedBox(width: 8),
                        SizedBox(
                          width: 132,
                          child: GradientButton(
                            label: online ? 'Pay & print' : 'Offline',
                            busy: _printing,
                            onPressed: online &&
                                    !_printing &&
                                    _documents.isNotEmpty
                                ? _print
                                : null,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}

class _QueueDocCard extends StatelessWidget {
  const _QueueDocCard({
    required this.doc,
    required this.onRemove,
  });

  final PrintDraftDocument doc;
  final VoidCallback? onRemove;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.fromLTRB(14, 12, 8, 12),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: AppColors.mist,
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.picture_as_pdf, color: AppColors.purple),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    doc.fileName,
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 15,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '${doc.paperSize.name} · ${doc.pageBreakdown} · ${doc.copies} cop${doc.copies == 1 ? 'y' : 'ies'}',
                    style: const TextStyle(
                      color: AppColors.muted,
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    '₱${doc.lineTotal.toStringAsFixed(2)}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w800,
                      color: AppColors.purple,
                    ),
                  ),
                ],
              ),
            ),
            IconButton(
              onPressed: onRemove,
              icon: const Icon(Icons.close),
              color: AppColors.muted,
              tooltip: 'Remove',
            ),
          ],
        ),
      ),
    );
  }
}
