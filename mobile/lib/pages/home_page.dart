import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../models/partner.dart';
import '../services/partners_repository.dart';
import '../theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

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
    // Recompute online/offline freshness every 30s even if Firestore is quiet.
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

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = user?.displayName?.trim();
    final greeting = (name != null && name.isNotEmpty) ? name : 'there';

    return Scaffold(
      appBar: AppBar(
        title: const Text('PrintStack'),
        actions: [
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => AuthService.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: StreamBuilder<List<Partner>>(
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
                _ErrorCard(
                  message: snapshot.error.toString(),
                  onRetry: () {
                    setState(() {
                      _partnersStream =
                          PartnersRepository.instance.watchPartners();
                    });
                  },
                ),
              ],
            );
          }

          final partners = snapshot.data ?? const <Partner>[];
          final onlineCount =
              partners.where((p) => p.location?.online == true).length;

          return RefreshIndicator(
            onRefresh: () async {
              setState(() {
                _partnersStream = PartnersRepository.instance.watchPartners();
              });
              await _partnersStream.first;
            },
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
              children: [
                _Greeting(greeting: greeting),
                const SizedBox(height: 6),
                const Text(
                  'Partner locations update in realtime',
                  style: TextStyle(color: AppColors.muted, fontSize: 14),
                ),
                const SizedBox(height: 20),
                if (partners.isEmpty)
                  const _EmptyCard()
                else ...[
                  Text(
                    '$onlineCount online · ${partners.length} partner${partners.length == 1 ? '' : 's'}',
                    style: const TextStyle(
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                  const SizedBox(height: 12),
                  ...partners.map(
                    (partner) => Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: _PartnerTile(partner: partner),
                    ),
                  ),
                ],
              ],
            ),
          );
        },
      ),
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

class _PartnerTile extends StatelessWidget {
  const _PartnerTile({required this.partner});

  final Partner partner;

  @override
  Widget build(BuildContext context) {
    final location = partner.location;
    final subtitleParts = <String>[
      if (partner.email.isNotEmpty) partner.email,
      if ((location?.label ?? '').isNotEmpty) location!.label,
    ];
    final subtitle = subtitleParts.join(' · ');

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Row(
          children: [
            _Logo(url: partner.logoUrl, name: partner.companyName),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    partner.companyName.isEmpty
                        ? 'Untitled partner'
                        : partner.companyName,
                    style: const TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: AppColors.navy,
                    ),
                  ),
                  if (subtitle.isNotEmpty) ...[
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: location?.online == true
                    ? const Color(0xFFE8F5E9)
                    : const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                location?.online == true ? 'Online' : 'Offline',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: location?.online == true
                      ? const Color(0xFF1B5E20)
                      : AppColors.muted,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _Logo extends StatelessWidget {
  const _Logo({required this.url, required this.name});

  final String url;
  final String name;

  @override
  Widget build(BuildContext context) {
    final trimmed = name.trim();
    final initial = trimmed.isEmpty ? 'P' : trimmed[0].toUpperCase();

    Widget fallback() {
      return Container(
        width: 52,
        height: 52,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          gradient: AppTheme.brandGradient,
          borderRadius: BorderRadius.circular(14),
        ),
        child: Text(
          initial,
          style: const TextStyle(
            color: Colors.white,
            fontWeight: FontWeight.w800,
            fontSize: 20,
          ),
        ),
      );
    }

    if (url.isEmpty) {
      return fallback();
    }

    return ClipRRect(
      borderRadius: BorderRadius.circular(14),
      child: Image.network(
        url,
        width: 52,
        height: 52,
        fit: BoxFit.cover,
        errorBuilder: (_, _, _) => fallback(),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard();

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
      ),
      child: const Column(
        children: [
          Icon(Icons.storefront_outlined, size: 36, color: AppColors.muted),
          SizedBox(height: 12),
          Text(
            'No partners yet',
            style: TextStyle(
              fontWeight: FontWeight.w700,
              fontSize: 16,
              color: AppColors.navy,
            ),
          ),
          SizedBox(height: 6),
          Text(
            'Partners created on the desktop admin will show up here.',
            textAlign: TextAlign.center,
            style: TextStyle(color: AppColors.muted),
          ),
        ],
      ),
    );
  }
}

class _ErrorCard extends StatelessWidget {
  const _ErrorCard({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFFEBEE),
        borderRadius: BorderRadius.circular(16),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(message, style: const TextStyle(color: Color(0xFFB71C1C))),
          const SizedBox(height: 12),
          OutlinedButton(onPressed: onRetry, child: const Text('Try again')),
        ],
      ),
    );
  }
}
