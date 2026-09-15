import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';

import '../api/api_client.dart';
import '../components/buttons/gradient_button.dart';
import '../components/common/message_banner.dart';
import '../models/partner.dart';
import '../theme.dart';

/// PayMongo checkout for a customer print order (GCash / Maya).
class PrintOrderPaymentPage extends StatefulWidget {
  const PrintOrderPaymentPage({
    super.key,
    required this.partner,
    required this.printJobId,
    required this.orderNumber,
    required this.amountDisplay,
  });

  final Partner partner;
  final String printJobId;
  final String orderNumber;
  final String amountDisplay;

  @override
  State<PrintOrderPaymentPage> createState() => _PrintOrderPaymentPageState();
}

class _PrintOrderPaymentPageState extends State<PrintOrderPaymentPage> {
  final _nameCtrl = TextEditingController();
  final _emailCtrl = TextEditingController();
  final _phoneCtrl = TextEditingController();

  bool _loading = true;
  bool _paying = false;
  bool _awaitingReturn = false;
  String? _error;
  String _method = 'gcash';
  String? _paymentIntentId;
  String? _clientKey;
  String? _amountDisplay;

  @override
  void initState() {
    super.initState();
    final user = FirebaseAuth.instance.currentUser;
    _nameCtrl.text = (user?.displayName ?? '').trim();
    _emailCtrl.text = (user?.email ?? '').trim();
    _amountDisplay = widget.amountDisplay;
    _loadIntent();
  }

  @override
  void dispose() {
    _nameCtrl.dispose();
    _emailCtrl.dispose();
    _phoneCtrl.dispose();
    super.dispose();
  }

  Future<void> _loadIntent() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final data = await ApiClient.instance.createPrintOrderPaymentIntent(
        partnerId: widget.partner.id,
        printJobId: widget.printJobId,
      );
      if (!mounted) return;
      setState(() {
        _paymentIntentId = (data['paymentIntentId'] ?? '').toString();
        _clientKey = (data['clientKey'] ?? '').toString();
        final display = (data['amountDisplay'] ?? '').toString().trim();
        if (display.isNotEmpty) _amountDisplay = display;
      });
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (error) {
      if (mounted) {
        setState(() => _error = 'Could not start payment.');
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _pay() async {
    final intentId = _paymentIntentId;
    final clientKey = _clientKey;
    if (intentId == null ||
        intentId.isEmpty ||
        clientKey == null ||
        clientKey.isEmpty) {
      setState(() => _error = 'Payment is not ready yet.');
      return;
    }

    final phone = _phoneCtrl.text.trim();
    if (phone.isEmpty) {
      setState(() => _error = 'Phone number is required.');
      return;
    }
    final email = _emailCtrl.text.trim();
    if (email.isEmpty) {
      setState(() => _error = 'Email is required.');
      return;
    }

    setState(() {
      _paying = true;
      _error = null;
    });

    try {
      final data = await ApiClient.instance.payPrintOrder(
        paymentIntentId: intentId,
        clientKey: clientKey,
        paymentMethodType: _method,
        billing: {
          'name': _nameCtrl.text.trim().isEmpty
              ? 'Customer'
              : _nameCtrl.text.trim(),
          'email': email,
          'phone': phone,
        },
        returnPath: '/payment/confirmation',
      );

      final redirect = (data['redirectUrl'] ?? '').toString().trim();
      if (redirect.isNotEmpty) {
        final uri = Uri.tryParse(redirect);
        if (uri != null) {
          await launchUrl(uri, mode: LaunchMode.externalApplication);
        }
        if (!mounted) return;
        setState(() => _awaitingReturn = true);
        return;
      }

      if (!mounted) return;
      _finishSuccess();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Payment failed.');
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  Future<void> _confirmReturn() async {
    final intentId = _paymentIntentId;
    if (intentId == null || intentId.isEmpty) return;

    setState(() {
      _paying = true;
      _error = null;
    });
    try {
      await ApiClient.instance.finalizePrintOrderPayment(intentId);
      if (!mounted) return;
      _finishSuccess();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _error =
              '${error.message} Finish paying in the wallet app, then tap again.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(
          () => _error =
              'Could not confirm payment yet. Finish in the wallet app, then try again.',
        );
      }
    } finally {
      if (mounted) setState(() => _paying = false);
    }
  }

  void _finishSuccess() {
    final order = widget.orderNumber.trim();
    final message = order.isEmpty
        ? 'Payment confirmed. Your order is queued for printing.'
        : 'Payment confirmed. Order #$order is queued for printing.';
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(message)));
    Navigator.of(context).pop(true);
  }

  @override
  Widget build(BuildContext context) {
    final shopName = widget.partner.companyName.isEmpty
        ? 'Shop'
        : widget.partner.companyName;
    final amount = (_amountDisplay ?? widget.amountDisplay).trim();
    final amountLabel = amount.isEmpty
        ? '—'
        : amount.startsWith('₱')
            ? amount
            : '₱$amount';

    return Scaffold(
      backgroundColor: AppColors.mist,
      appBar: AppBar(title: const Text('Pay for print')),
      body: _loading
          ? const Center(child: CircularProgressIndicator())
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 24),
              children: [
                if (_error != null) ...[
                  MessageBanner(message: _error!, isError: true),
                  const SizedBox(height: 12),
                ],
                Material(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(16),
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          shopName,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            fontSize: 16,
                            color: AppColors.navy,
                          ),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          widget.orderNumber.trim().isEmpty
                              ? 'Print order'
                              : 'Order #${widget.orderNumber}',
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          amountLabel,
                          style: const TextStyle(
                            fontSize: 28,
                            fontWeight: FontWeight.w800,
                            color: AppColors.purple,
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Secured checkout via PayMongo',
                          style: TextStyle(
                            color: AppColors.muted,
                            fontSize: 12,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 16),
                const Text(
                  'Payment method',
                  style: TextStyle(
                    fontWeight: FontWeight.w700,
                    color: AppColors.navy,
                  ),
                ),
                const SizedBox(height: 8),
                Row(
                  children: [
                    Expanded(
                      child: _MethodChip(
                        label: 'GCash',
                        selected: _method == 'gcash',
                        onTap: _paying
                            ? null
                            : () => setState(() => _method = 'gcash'),
                      ),
                    ),
                    const SizedBox(width: 8),
                    Expanded(
                      child: _MethodChip(
                        label: 'Maya',
                        selected: _method == 'paymaya',
                        onTap: _paying
                            ? null
                            : () => setState(() => _method = 'paymaya'),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                TextField(
                  controller: _nameCtrl,
                  enabled: !_paying,
                  decoration: const InputDecoration(labelText: 'Full name'),
                  textCapitalization: TextCapitalization.words,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _emailCtrl,
                  enabled: !_paying,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: _phoneCtrl,
                  enabled: !_paying,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    hintText: '09XXXXXXXXX',
                  ),
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                ),
                const SizedBox(height: 20),
                if (_awaitingReturn) ...[
                  const MessageBanner(
                    message:
                        'Complete payment in GCash/Maya, then tap below to confirm.',
                  ),
                  const SizedBox(height: 12),
                  GradientButton(
                    label: 'I\'ve paid — confirm',
                    busy: _paying,
                    onPressed: _paying ? null : _confirmReturn,
                  ),
                ] else
                  GradientButton(
                    label: 'Pay $amountLabel',
                    busy: _paying,
                    onPressed: _paying || _paymentIntentId == null
                        ? null
                        : _pay,
                  ),
              ],
            ),
    );
  }
}

class _MethodChip extends StatelessWidget {
  const _MethodChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: selected ? AppColors.purple.withValues(alpha: 0.12) : Colors.white,
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 14),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: selected ? AppColors.purple : const Color(0xFFE2E8F0),
              width: selected ? 1.5 : 1,
            ),
          ),
          alignment: Alignment.center,
          child: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w700,
              color: selected ? AppColors.purpleDark : AppColors.navy,
            ),
          ),
        ),
      ),
    );
  }
}
