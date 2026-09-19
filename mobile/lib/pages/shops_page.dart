import 'package:flutter/material.dart';

import '../components/common/empty_state.dart';
import '../components/common/error_card.dart';
import '../components/partners/partner_card.dart';
import '../models/partner.dart';
import '../services/favorites_repository.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import 'shop_pricing_page.dart';

enum _ShopAvailability { all, online, offline, favorites }

enum _ShopService { all, printing, xerox }

class ShopsPage extends StatefulWidget {
  const ShopsPage({super.key});

  @override
  State<ShopsPage> createState() => _ShopsPageState();
}

class _ShopsPageState extends State<ShopsPage> {
  final _searchController = TextEditingController();
  String _query = '';
  _ShopAvailability _availability = _ShopAvailability.all;
  _ShopService _service = _ShopService.all;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<Partner> _filter(List<Partner> partners, Set<String> favoriteIds) {
    final query = _query.trim().toLowerCase();
    return partners
        .where((partner) {
          final online = partner.location?.online == true;
          final matchesAvailability = switch (_availability) {
            _ShopAvailability.all => true,
            _ShopAvailability.online => online,
            _ShopAvailability.offline => !online,
            _ShopAvailability.favorites => favoriteIds.contains(partner.id),
          };
          final matchesService = switch (_service) {
            _ShopService.all => true,
            _ShopService.printing => partner.services.printing,
            _ShopService.xerox => partner.services.xerox,
          };
          final matchesQuery =
              query.isEmpty ||
              partner.companyName.toLowerCase().contains(query) ||
              partner.email.toLowerCase().contains(query) ||
              (partner.location?.label ?? '').toLowerCase().contains(query);
          return matchesAvailability && matchesService && matchesQuery;
        })
        .toList(growable: false);
  }

  void _openShop(Partner partner) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => ShopPricingPage(partner: partner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<List<Partner>>(
      stream: PartnersRepository.instance.watchPartners(),
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting &&
            !snapshot.hasData) {
          return const Center(child: CircularProgressIndicator());
        }

        if (snapshot.hasError) {
          return ListView(
            padding: const EdgeInsets.all(20),
            children: [
              ErrorCard(message: 'Could not load shops.\n\n${snapshot.error}'),
            ],
          );
        }

        return StreamBuilder<Set<String>>(
          stream: FavoritesRepository.instance.watchFavoriteShopIds(),
          builder: (context, favoritesSnapshot) {
            final favoriteIds = favoritesSnapshot.data ?? const <String>{};
            final shops = _filter(snapshot.data ?? const [], favoriteIds);

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 16, 16, 32),
              children: [
            TextField(
              controller: _searchController,
              onChanged: (value) => setState(() => _query = value),
              decoration: InputDecoration(
                hintText: 'Search shops or locations',
                prefixIcon: const Icon(Icons.search),
                suffixIcon: _query.isEmpty
                    ? null
                    : IconButton(
                        tooltip: 'Clear search',
                        onPressed: () {
                          _searchController.clear();
                          setState(() => _query = '');
                        },
                        icon: const Icon(Icons.close),
                      ),
                filled: true,
                fillColor: Colors.white,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(14),
                  borderSide: BorderSide.none,
                ),
              ),
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<_ShopAvailability>(
                    initialValue: _availability,
                    isDense: true,
                    decoration: const InputDecoration(
                      labelText: 'Availability',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: _ShopAvailability.all,
                        child: Text('All'),
                      ),
                      DropdownMenuItem(
                        value: _ShopAvailability.online,
                        child: Text('Online'),
                      ),
                      DropdownMenuItem(
                        value: _ShopAvailability.offline,
                        child: Text('Offline'),
                      ),
                      DropdownMenuItem(
                        value: _ShopAvailability.favorites,
                        child: Text('Favorites'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _availability = value);
                      }
                    },
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: DropdownButtonFormField<_ShopService>(
                    initialValue: _service,
                    isDense: true,
                    decoration: const InputDecoration(
                      labelText: 'Service',
                      contentPadding: EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 10,
                      ),
                    ),
                    items: const [
                      DropdownMenuItem(
                        value: _ShopService.all,
                        child: Text('All'),
                      ),
                      DropdownMenuItem(
                        value: _ShopService.printing,
                        child: Text('Printing'),
                      ),
                      DropdownMenuItem(
                        value: _ShopService.xerox,
                        child: Text('Xerox'),
                      ),
                    ],
                    onChanged: (value) {
                      if (value != null) {
                        setState(() => _service = value);
                      }
                    },
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              '${shops.length} shop${shops.length == 1 ? '' : 's'}',
              style: const TextStyle(
                color: AppColors.muted,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 10),
            if (shops.isEmpty)
              const EmptyState(
                icon: Icons.storefront_outlined,
                title: 'No shops found',
                message: 'Try changing your search or filters.',
              )
            else
              ...shops.map(
                (shop) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: PartnerCard(
                    partner: shop,
                    onTap: () => _openShop(shop),
                  ),
                ),
              ),
              ],
            );
          },
        );
      },
    );
  }
}
