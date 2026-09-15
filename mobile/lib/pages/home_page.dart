import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../components/buttons/gradient_button.dart';
import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/common/status_chip.dart';
import '../models/partner.dart';
import '../services/partners_repository.dart';
import '../theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({
    super.key,
    this.onOpenPrint,
    this.onOpenHistory,
  });

  final VoidCallback? onOpenPrint;
  final VoidCallback? onOpenHistory;

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Stream<List<Partner>> _partnersStream;
  Timer? _tick;

  @override
  void initState() {
    super.initState();
    _partnersStream = PartnersRepository.instance.watchPartners();
    _tick = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) {
        setState(() {});
      }
    });
  }

  @override
  void dispose() {
    _tick?.cancel();
    super.dispose();
  }

  void _reload() {
    setState(() {
      _partnersStream = PartnersRepository.instance.watchPartners();
    });
  }

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = user?.displayName?.trim();
    final greeting = (name != null && name.isNotEmpty) ? name : 'there';

    return StreamBuilder<List<Partner>>(
      stream: _partnersStream,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              _Greeting(greeting: greeting),
              const SizedBox(height: 20),
              ErrorCard(
                message: snapshot.error.toString(),
                onRetry: _reload,
              ),
            ],
          );
        }

        final partners = snapshot.data ?? const <Partner>[];
        final online =
            partners.where((p) => p.location?.online == true).toList();

        return RefreshIndicator(
          onRefresh: () async {
            _reload();
            await _partnersStream.first;
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
            children: [
              _Greeting(greeting: greeting),
              const SizedBox(height: 6),
              const Text(
                'Ready to print when shops are online.',
                style: TextStyle(color: AppColors.muted, fontSize: 14),
              ),
              const SizedBox(height: 20),
              Row(
                children: [
                  Expanded(
                    child: _StatCard(
                      label: 'Online',
                      value: '${online.length}',
                      accent: const Color(0xFF1B5E20),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _StatCard(
                      label: 'Shops',
                      value: '${partners.length}',
                      accent: AppColors.purpleDark,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 20),
              GradientButton(
                label: 'Start a print job',
                onPressed: widget.onOpenPrint,
              ),
              const SizedBox(height: 10),
              OutlinedButton(
                onPressed: widget.onOpenHistory,
                child: const Text('View history'),
              ),
              const SizedBox(height: 24),
              const Text(
                'Online now',
                style: TextStyle(
                  fontWeight: FontWeight.w800,
                  fontSize: 16,
                  color: AppColors.navy,
                ),
              ),
              const SizedBox(height: 12),
              if (online.isEmpty)
                const EmptyState(
                  icon: Icons.storefront_outlined,
                  title: 'No shops online',
                  message:
                      'You can still queue jobs — printing starts when a shop comes online.',
                )
              else
                ...online.take(5).map(
                  (partner) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _OnlinePartnerRow(partner: partner),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}

class _Greeting extends StatelessWidget {
  const _Greeting({required this.greeting});

  final String greeting;

  @override
  Widget build(BuildContext context) {
    return Text(
      'Hi, $greeting',
      style: const TextStyle(
        fontSize: 28,
        fontWeight: FontWeight.w800,
        color: AppColors.navy,
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.label,
    required this.value,
    required this.accent,
  });

  final String label;
  final String value;
  final Color accent;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: const TextStyle(color: AppColors.muted)),
          const SizedBox(height: 6),
          Text(
            value,
            style: TextStyle(
              fontSize: 28,
              fontWeight: FontWeight.w800,
              color: accent,
            ),
          ),
        ],
      ),
    );
  }
}

class _OnlinePartnerRow extends StatelessWidget {
  const _OnlinePartnerRow({required this.partner});

  final Partner partner;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Expanded(
            child: Text(
              partner.companyName.isEmpty
                  ? 'Untitled shop'
                  : partner.companyName,
              style: const TextStyle(
                fontWeight: FontWeight.w700,
                color: AppColors.navy,
              ),
            ),
          ),
          const StatusChip(label: 'Online', active: true),
        ],
      ),
    );
  }
}
