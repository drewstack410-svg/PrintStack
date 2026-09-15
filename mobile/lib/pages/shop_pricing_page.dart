import 'package:flutter/material.dart';

import '../components/buttons/gradient_button.dart';
import '../components/common/empty_state.dart';
import '../components/common/message_banner.dart';
import '../components/partners/partner_avatar.dart';
import '../models/partner.dart';
import '../services/partners_repository.dart';
import '../theme.dart';
import 'partner_order_page.dart';

enum _UnitFilter { all, inches, mm }

enum _SortMode { name, priceBw, priceColor, size }

class ShopPricingPage extends StatefulWidget {
  const ShopPricingPage({super.key, required this.partner});

  final Partner partner;

  @override
  State<ShopPricingPage> createState() => _ShopPricingPageState();
}

class _ShopPricingPageState extends State<ShopPricingPage> {
  final _searchController = TextEditingController();
  String _query = '';
  _UnitFilter _unitFilter = _UnitFilter.all;
  _SortMode _sortMode = _SortMode.name;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  List<PaperSize> _sizesOf(Partner partner) {
    final raw = partner.paperSizes;
    return raw.isEmpty ? PaperSize.defaults : raw;
  }

  List<PaperSize> _filteredOf(Partner partner) {
    final q = _query.trim().toLowerCase();
    var list = _sizesOf(partner).where((size) {
      if (_unitFilter == _UnitFilter.inches && size.unit != 'in') {
        return false;
      }
      if (_unitFilter == _UnitFilter.mm && size.unit != 'mm') {
        return false;
      }
      if (q.isEmpty) {
        return true;
      }
      return size.name.toLowerCase().contains(q) ||
          size.sizeLabel.toLowerCase().contains(q) ||
          size.unit.toLowerCase().contains(q);
    }).toList();

    list.sort((a, b) {
      switch (_sortMode) {
        case _SortMode.priceBw:
          return a.priceBw.compareTo(b.priceBw);
        case _SortMode.priceColor:
          return a.priceColor.compareTo(b.priceColor);
        case _SortMode.size:
          return _areaInches(a).compareTo(_areaInches(b));
        case _SortMode.name:
          return a.name.toLowerCase().compareTo(b.name.toLowerCase());
      }
    });
    return list;
  }

  double _areaInches(PaperSize size) {
    final w = size.unit == 'mm' ? size.width / 25.4 : size.width;
    final h = size.unit == 'mm' ? size.height / 25.4 : size.height;
    return w * h;
  }

  void _openOrder(Partner partner) {
    if (partner.location?.online != true) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('This shop went offline.')),
      );
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => PartnerOrderPage(partner: partner),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<Partner?>(
      stream: PartnersRepository.instance.watchPartner(widget.partner.id),
      builder: (context, snapshot) {
        final partner = snapshot.data ?? widget.partner;
        final online = partner.location?.online == true;
        final filtered = _filteredOf(partner);
        final sizes = _sizesOf(partner);
        final bottomInset = MediaQuery.paddingOf(context).bottom;
        final shopName =
            partner.companyName.isEmpty ? 'Shop pricing' : partner.companyName;

        return Scaffold(
          backgroundColor: AppColors.mist,
          appBar: AppBar(
            titleSpacing: 0,
            title: Row(
              children: [
                PartnerAvatar(
                  url: partner.logoUrl,
                  name: shopName,
                  size: 34,
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    shopName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
            actions: [
              Padding(
                padding: const EdgeInsets.only(right: 16),
                child: Center(child: _StatusGlowLight(online: online)),
              ),
            ],
          ),
          body: Column(
            children: [
              if (!online)
                const Padding(
                  padding: EdgeInsets.fromLTRB(14, 12, 14, 0),
                  child: MessageBanner(
                    message: 'This shop is offline. Printing is unavailable.',
                    isError: true,
                  ),
                ),
              Expanded(
                child: ListView(
                  padding:
                      EdgeInsets.fromLTRB(14, 12, 14, 20 + bottomInset + 80),
                  children: [
                    if ((partner.location?.label ?? '').isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 10),
                        child: Text(
                          partner.location!.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            color: AppColors.muted,
                            fontSize: 13,
                          ),
                        ),
                      ),
                    TextField(
                      controller: _searchController,
                      onChanged: (value) => setState(() => _query = value),
                      decoration: InputDecoration(
                        isDense: true,
                        hintText: 'Search layouts…',
                        prefixIcon: const Icon(Icons.search, size: 20),
                        suffixIcon: _query.isEmpty
                            ? null
                            : IconButton(
                                tooltip: 'Clear',
                                onPressed: () {
                                  _searchController.clear();
                                  setState(() => _query = '');
                                },
                                icon: const Icon(Icons.close, size: 18),
                              ),
                      ),
                    ),
                    const SizedBox(height: 10),
                    Row(
                      children: [
                        Expanded(
                          child: DropdownButtonFormField<_UnitFilter>(
                            value: _unitFilter,
                            isDense: true,
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Unit',
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: _UnitFilter.all,
                                child: Text('All units'),
                              ),
                              DropdownMenuItem(
                                value: _UnitFilter.inches,
                                child: Text('Inches'),
                              ),
                              DropdownMenuItem(
                                value: _UnitFilter.mm,
                                child: Text('Millimeters'),
                              ),
                            ],
                            onChanged: (value) {
                              if (value == null) {
                                return;
                              }
                              setState(() => _unitFilter = value);
                            },
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: DropdownButtonFormField<_SortMode>(
                            value: _sortMode,
                            isDense: true,
                            decoration: const InputDecoration(
                              isDense: true,
                              labelText: 'Sort',
                              contentPadding: EdgeInsets.symmetric(
                                horizontal: 12,
                                vertical: 10,
                              ),
                            ),
                            items: const [
                              DropdownMenuItem(
                                value: _SortMode.name,
                                child: Text('Name'),
                              ),
                              DropdownMenuItem(
                                value: _SortMode.priceBw,
                                child: Text('B&W price'),
                              ),
                              DropdownMenuItem(
                                value: _SortMode.priceColor,
                                child: Text('Color price'),
                              ),
                              DropdownMenuItem(
                                value: _SortMode.size,
                                child: Text('Size'),
                              ),
                            ],
                            onChanged: (value) {
                              if (value == null) {
                                return;
                              }
                              setState(() => _sortMode = value);
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      '${filtered.length} layout${filtered.length == 1 ? '' : 's'}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontWeight: FontWeight.w700,
                        fontSize: 12,
                      ),
                    ),
                    const SizedBox(height: 8),
                    if (filtered.isEmpty)
                      const EmptyState(
                        icon: Icons.crop_free,
                        title: 'No layouts found',
                        message: 'Try another search or clear the filters.',
                      )
                    else
                      Material(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(14),
                        child: Column(
                          children: [
                            for (var i = 0; i < filtered.length; i++) ...[
                              _PricingRow(size: filtered[i]),
                              if (i < filtered.length - 1)
                                const Divider(
                                  height: 1,
                                  indent: 12,
                                  endIndent: 12,
                                ),
                            ],
                          ],
                        ),
                      ),
                  ],
                ),
              ),
              Material(
                elevation: 10,
                color: Colors.white,
                shadowColor: Colors.black26,
                child: SafeArea(
                  top: false,
                  child: Padding(
                    padding: const EdgeInsets.fromLTRB(14, 10, 14, 10),
                    child: GradientButton(
                      label: online ? 'Print at this shop' : 'Shop offline',
                      onPressed: !online || sizes.isEmpty
                          ? null
                          : () => _openOrder(partner),
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

class _PricingRow extends StatelessWidget {
  const _PricingRow({required this.size});

  final PaperSize size;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  size.name.isEmpty ? 'Untitled layout' : size.name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontWeight: FontWeight.w800,
                    color: AppColors.navy,
                    fontSize: 14,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  size.sizeLabel,
                  style: const TextStyle(
                    color: AppColors.muted,
                    fontSize: 12,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 10),
          _MiniPrice(
            icon: Icons.filter_b_and_w,
            value: '₱${size.priceBw.toStringAsFixed(2)}',
            color: AppColors.navy,
          ),
          const SizedBox(width: 8),
          _MiniPrice(
            icon: Icons.palette_outlined,
            value: '₱${size.priceColor.toStringAsFixed(2)}',
            color: AppColors.purple,
          ),
        ],
      ),
    );
  }
}

class _MiniPrice extends StatelessWidget {
  const _MiniPrice({
    required this.icon,
    required this.value,
    required this.color,
  });

  final IconData icon;
  final String value;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.08),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 13, color: color),
          const SizedBox(width: 4),
          Text(
            value,
            style: TextStyle(
              color: color,
              fontWeight: FontWeight.w800,
              fontSize: 12,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatusGlowLight extends StatefulWidget {
  const _StatusGlowLight({required this.online});

  final bool online;

  @override
  State<_StatusGlowLight> createState() => _StatusGlowLightState();
}

class _StatusGlowLightState extends State<_StatusGlowLight>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 1400),
  );

  @override
  void initState() {
    super.initState();
    if (widget.online) {
      _controller.repeat();
    }
  }

  @override
  void didUpdateWidget(covariant _StatusGlowLight oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.online && !_controller.isAnimating) {
      _controller.repeat();
    } else if (!widget.online && _controller.isAnimating) {
      _controller
        ..stop()
        ..value = 0;
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.online) {
      return Container(
        width: 10,
        height: 10,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          color: Colors.white.withValues(alpha: 0.28),
        ),
      );
    }

    return SizedBox(
      width: 18,
      height: 18,
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          final t = _controller.value;
          final pulse = 1 - t;
          return Stack(
            alignment: Alignment.center,
            children: [
              Container(
                width: 16 * (0.5 + t * 0.85),
                height: 16 * (0.5 + t * 0.85),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF22C55E).withValues(alpha: 0.4 * pulse),
                ),
              ),
              Container(
                width: 9,
                height: 9,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF4ADE80),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withValues(alpha: 0.95),
                      blurRadius: 8,
                      spreadRadius: 1,
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
