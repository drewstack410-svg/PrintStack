import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

import '../api/api_client.dart';
import '../components/buttons/gradient_button.dart';
import '../components/common/message_banner.dart';
import '../components/partners/partner_avatar.dart';
import '../models/partner.dart';
import '../models/print_draft_document.dart';
import '../theme.dart';
import 'payment_success_page.dart';

/// Concise checkout + PayMongo redirect in an in-app WebView.
class PrintOrderPaymentPage extends StatefulWidget {
  const PrintOrderPaymentPage({
    super.key,
    required this.partner,
    required this.printJobId,
    required this.orderNumber,
    required this.amountDisplay,
    this.documents = const [],
  });

  final Partner partner;
  final String printJobId;
  final String orderNumber;
  final String amountDisplay;
  final List<PrintDraftDocument> documents;

  @override
  State<PrintOrderPaymentPage> createState() => _PrintOrderPaymentPageState();
}

class _PrintOrderPaymentPageState extends State<PrintOrderPaymentPage> {
  final _phoneCtrl = TextEditingController();

  bool _loading = true;
  bool _paying = false;
  bool _finalizing = false;
  String? _error;
  String _method = 'gcash';
  String? _paymentIntentId;
  String? _clientKey;
  String? _amountDisplay;
  String? _checkoutUrl;
  WebViewController? _webView;

  @override
  void initState() {
    super.initState();
    _amountDisplay = widget.amountDisplay;
    _loadIntent();
  }

  @override
  void dispose() {
    _phoneCtrl.dispose();
    super.dispose();
  }

  String get _amountLabel {
    final amount = (_amountDisplay ?? widget.amountDisplay).trim();
    if (amount.isEmpty) return '—';
    return amount.startsWith('₱') ? amount : '₱$amount';
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
    } catch (_) {
      if (mounted) setState(() => _error = 'Could not start payment.');
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  bool _isReturnUrl(Uri uri) {
    final path = uri.path.toLowerCase();
    if (path.contains('payment/confirmation') || path.contains('payment/return')) {
      return true;
    }
    return uri.queryParameters.containsKey('payment_intent_id') ||
        uri.queryParameters.containsKey('paymentIntentId');
  }

  Future<void> _openCheckout(String url) async {
    final controller = WebViewController()
      ..setJavaScriptMode(JavaScriptMode.unrestricted)
      ..setNavigationDelegate(
        NavigationDelegate(
          onNavigationRequest: (request) {
            final uri = Uri.tryParse(request.url);
            if (uri == null) return NavigationDecision.navigate;

            if (_isReturnUrl(uri)) {
              _onPaymongoReturn(uri);
              return NavigationDecision.prevent;
            }

            final scheme = uri.scheme.toLowerCase();
            if (scheme != 'http' && scheme != 'https' && scheme != 'about') {
              launchUrl(uri, mode: LaunchMode.externalApplication);
              return NavigationDecision.prevent;
            }

            return NavigationDecision.navigate;
          },
          onPageFinished: (url) {
            final uri = Uri.tryParse(url);
            if (uri != null && _isReturnUrl(uri)) {
              _onPaymongoReturn(uri);
            }
          },
        ),
      )
      ..loadRequest(Uri.parse(url));

    setState(() {
      _checkoutUrl = url;
      _webView = controller;
      _paying = false;
    });
  }

  Future<void> _onPaymongoReturn(Uri uri) async {
    if (_finalizing) return;
    setState(() {
      _finalizing = true;
      _checkoutUrl = null;
      _webView = null;
      _error = null;
    });

    final intentId = uri.queryParameters['payment_intent_id'] ??
        uri.queryParameters['paymentIntentId'] ??
        _paymentIntentId;

    if (intentId == null || intentId.isEmpty) {
      setState(() {
        _finalizing = false;
        _error = 'Payment returned without an intent id.';
      });
      return;
    }

    try {
      await ApiClient.instance.finalizePrintOrderPayment(intentId);
      if (!mounted) return;
      await _finishSuccess();
    } on ApiException catch (error) {
      if (mounted) {
        setState(() {
          _finalizing = false;
          _error = '${error.message} Finish in GCash/Maya, then tap Pay again.';
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _finalizing = false;
          _error = 'Could not confirm payment yet. Try Pay again.';
        });
      }
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
    if (phone.length < 10) {
      setState(() => _error = 'Enter a valid mobile number.');
      return;
    }

    final user = FirebaseAuth.instance.currentUser;
    final email = (user?.email ?? '').trim();
    if (email.isEmpty) {
      setState(() => _error = 'Your account needs an email for receipts.');
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
          'name': (user?.displayName ?? '').trim().isEmpty
              ? 'Customer'
              : user!.displayName!.trim(),
          'email': email,
          'phone': phone,
        },
        returnPath: '/payment/confirmation',
      );

      final redirect = (data['redirectUrl'] ?? '').toString().trim();
      if (redirect.isNotEmpty) {
        await _openCheckout(redirect);
        return;
      }

      if (!mounted) return;
      await _finishSuccess();
    } on ApiException catch (error) {
      if (mounted) setState(() => _error = error.message);
    } catch (_) {
      if (mounted) setState(() => _error = 'Payment failed.');
    } finally {
      if (mounted && _checkoutUrl == null) {
        setState(() => _paying = false);
      }
    }
  }

  Future<void> _finishSuccess() async {
    final shopName = widget.partner.companyName.isEmpty
        ? 'Shop'
        : widget.partner.companyName;
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        builder: (_) => PaymentSuccessPage(
          orderNumber: widget.orderNumber,
          shopName: shopName,
          amountDisplay: _amountLabel,
        ),
      ),
    );
    if (!mounted) return;
    Navigator.of(context).pop(true);
  }

  void _closeCheckout() {
    setState(() {
      _checkoutUrl = null;
      _webView = null;
      _paying = false;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_checkoutUrl != null && _webView != null) {
      return Scaffold(
        backgroundColor: Colors.white,
        appBar: AppBar(
          title: const Text('PayMongo'),
          leading: IconButton(
            icon: const Icon(Icons.close),
            onPressed: _closeCheckout,
          ),
        ),
        body: WebViewWidget(controller: _webView!),
      );
    }

    final shopName = widget.partner.companyName.isEmpty
        ? 'Shop'
        : widget.partner.companyName;
    final orderLabel = widget.orderNumber.trim().isEmpty
        ? 'Print order'
        : 'Order #${widget.orderNumber}';

    return Scaffold(
      backgroundColor: AppColors.mist,
      appBar: AppBar(title: const Text('Checkout')),
      body: _loading || _finalizing
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
                    padding: const EdgeInsets.all(14),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            PartnerAvatar(
                              name: shopName,
                              url: widget.partner.logoUrl,
                              size: 44,
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    shopName,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                      fontWeight: FontWeight.w800,
                                      fontSize: 15,
                                      color: AppColors.navy,
                                    ),
                                  ),
                                  Text(
                                    orderLabel,
                                    style: const TextStyle(
                                      color: AppColors.muted,
                                      fontSize: 12,
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            Text(
                              _amountLabel,
                              style: const TextStyle(
                                fontWeight: FontWeight.w800,
                                fontSize: 18,
                                color: AppColors.purple,
                              ),
                            ),
                          ],
                        ),
                        if (widget.documents.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          const Divider(height: 1),
                          const SizedBox(height: 8),
                          ...widget.documents.map((doc) {
                            return Padding(
                              padding: const EdgeInsets.only(bottom: 6),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  const Icon(
                                    Icons.description_outlined,
                                    size: 16,
                                    color: AppColors.muted,
                                  ),
                                  const SizedBox(width: 6),
                                  Expanded(
                                    child: Text(
                                      '${doc.fileName} · ${doc.paperSize.name} · ×${doc.copies}',
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: const TextStyle(
                                        fontSize: 12.5,
                                        color: AppColors.navy,
                                      ),
                                    ),
                                  ),
                                  Text(
                                    '₱${doc.lineTotal.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      fontSize: 12.5,
                                      fontWeight: FontWeight.w600,
                                      color: AppColors.muted,
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),
                        ],
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 14),
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
                const SizedBox(height: 12),
                TextField(
                  controller: _phoneCtrl,
                  enabled: !_paying,
                  decoration: const InputDecoration(
                    labelText: 'Mobile number',
                    hintText: '09XXXXXXXXX',
                    isDense: true,
                  ),
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(11),
                  ],
                ),
                const SizedBox(height: 16),
                GradientButton(
                  label: 'Pay $_amountLabel',
                  busy: _paying,
                  onPressed: _paying || _paymentIntentId == null ? null : _pay,
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
          padding: const EdgeInsets.symmetric(vertical: 12),
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
