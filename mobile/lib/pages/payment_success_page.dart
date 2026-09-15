import 'package:flutter/material.dart';

import '../components/buttons/gradient_button.dart';
import '../theme.dart';

/// Shown after PayMongo confirms payment.
class PaymentSuccessPage extends StatefulWidget {
  const PaymentSuccessPage({
    super.key,
    required this.orderNumber,
    required this.shopName,
    required this.amountDisplay,
  });

  final String orderNumber;
  final String shopName;
  final String amountDisplay;

  @override
  State<PaymentSuccessPage> createState() => _PaymentSuccessPageState();
}

class _PaymentSuccessPageState extends State<PaymentSuccessPage>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;
  late final Animation<double> _scale;
  late final Animation<double> _fade;
  late final Animation<double> _check;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );
    _scale = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.55, curve: Curves.elasticOut),
    );
    _fade = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.25, 0.75, curve: Curves.easeOut),
    );
    _check = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0.35, 0.9, curve: Curves.easeOutCubic),
    );
    _controller.forward();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _done() => Navigator.of(context).pop(true);

  @override
  Widget build(BuildContext context) {
    final order = widget.orderNumber.trim();
    final amount = widget.amountDisplay.trim();
    final shop = widget.shopName.trim().isEmpty ? 'Shop' : widget.shopName.trim();

    return Scaffold(
      backgroundColor: AppColors.mist,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(24, 32, 24, 24),
          child: Column(
            children: [
              const Spacer(),
              ScaleTransition(
                scale: _scale,
                child: Container(
                  width: 108,
                  height: 108,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    gradient: AppTheme.brandGradient,
                    boxShadow: [
                      BoxShadow(
                        color: AppColors.purple.withValues(alpha: 0.35),
                        blurRadius: 24,
                        offset: const Offset(0, 10),
                      ),
                    ],
                  ),
                  child: FadeTransition(
                    opacity: _check,
                    child: const Icon(
                      Icons.check_rounded,
                      color: Colors.white,
                      size: 58,
                    ),
                  ),
                ),
              ),
              const SizedBox(height: 28),
              FadeTransition(
                opacity: _fade,
                child: Column(
                  children: [
                    const Text(
                      'Payment successful',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w800,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      order.isEmpty
                          ? 'Your order is queued at $shop.'
                          : 'Order #$order is queued at $shop.',
                      textAlign: TextAlign.center,
                      style: const TextStyle(
                        fontSize: 14,
                        color: AppColors.muted,
                        height: 1.35,
                      ),
                    ),
                    if (amount.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        amount.startsWith('₱') ? amount : '₱$amount',
                        style: const TextStyle(
                          fontSize: 28,
                          fontWeight: FontWeight.w800,
                          color: AppColors.purple,
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              const Spacer(),
              GradientButton(
                label: 'Done',
                onPressed: _done,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
