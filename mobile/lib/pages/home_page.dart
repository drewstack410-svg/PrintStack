import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../api/api_client.dart';
import '../auth/auth_service.dart';
import '../models/partner.dart';
import '../theme.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage> {
  late Future<List<Partner>> _partnersFuture;

  @override
  void initState() {
    super.initState();
    _partnersFuture = ApiClient.instance.listPartners();
  }

  Future<void> _refresh() async {
    final next = ApiClient.instance.listPartners();
    setState(() => _partnersFuture = next);
    await next;
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
            tooltip: 'Refresh',
            onPressed: _refresh,
            icon: const Icon(Icons.refresh),
          ),
          IconButton(
            tooltip: 'Sign out',
            onPressed: () => AuthService.instance.signOut(),
            icon: const Icon(Icons.logout),
          ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
          children: [
            Text(
              'Hi, $greeting',
              style: const TextStyle(
                fontSize: 28,
                fontWeight: FontWeight.w800,
                color: AppColors.navy,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Browse print partners near you',
              style: const TextStyle(color: AppColors.muted, fontSize: 14),
            ),
            const SizedBox(height: 20),
            FutureBuilder<List<Partner>>(
              future: _partnersFuture,
              builder: (context, snapshot) {
                if (snapshot.connectionState == ConnectionState.waiting) {
                  return const Padding(
                    padding: EdgeInsets.only(top: 48),
                    child: Center(child: CircularProgressIndicator()),
                  );
                }

                if (snapshot.hasError) {
                  return _ErrorCard(
                    message: snapshot.error.toString(),
                    onRetry: _refresh,
                  );
                }

                final partners = snapshot.data ?? const <Partner>[];
                if (partners.isEmpty) {
                  return const _EmptyCard();
                }

                return Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      '${partners.length} partner${partners.length == 1 ? '' : 's'}',
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.navy,
                      ),
                    ),
                    const SizedBox(height: 12),
                    ...partners.map((partner) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: _PartnerTile(partner: partner),
                        )),
                  ],
                );
              },
            ),
          ],
        ),
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
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: () {},
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
              if (location != null)
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 5,
                  ),
                  decoration: BoxDecoration(
                    color: location.online
                        ? const Color(0xFFE8F5E9)
                        : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    location.online ? 'Online' : 'Offline',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: location.online
                          ? const Color(0xFF1B5E20)
                          : AppColors.muted,
                    ),
                  ),
                ),
            ],
          ),
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
  final Future<void> Function() onRetry;

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
          Text(
            message,
            style: const TextStyle(color: Color(0xFFB71C1C)),
          ),
          const SizedBox(height: 12),
          OutlinedButton(
            onPressed: () => onRetry(),
            child: const Text('Try again'),
          ),
        ],
      ),
    );
  }
}
