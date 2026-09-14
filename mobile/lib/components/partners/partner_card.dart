import 'package:flutter/material.dart';

import '../../models/partner.dart';
import '../../theme.dart';
import '../common/status_chip.dart';
import 'partner_avatar.dart';

class PartnerCard extends StatelessWidget {
  const PartnerCard({
    super.key,
    required this.partner,
    required this.onTap,
  });

  final Partner partner;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final location = partner.location;
    final subtitleParts = <String>[
      if (partner.email.isNotEmpty) partner.email,
      if ((location?.label ?? '').isNotEmpty) location!.label,
    ];
    final subtitle = subtitleParts.join(' · ');
    final online = location?.online == true;

    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              PartnerAvatar(
                url: partner.logoUrl,
                name: partner.companyName,
              ),
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
              StatusChip(
                label: online ? 'Online' : 'Offline',
                active: online,
              ),
              const SizedBox(width: 6),
              const Icon(Icons.chevron_right, color: AppColors.muted),
            ],
          ),
        ),
      ),
    );
  }
}
