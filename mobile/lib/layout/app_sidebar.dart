import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../theme.dart';
import 'nav_destinations.dart';

class AppSidebar extends StatelessWidget {
  const AppSidebar({
    super.key,
    required this.selected,
    required this.onSelect,
  });

  final AppNavId selected;
  final ValueChanged<AppNavId> onSelect;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = (user?.displayName ?? '').trim();
    final email = (user?.email ?? '').trim();
    final label = name.isNotEmpty ? name : (email.isNotEmpty ? email : 'Customer');
    final initial = label.isNotEmpty ? label[0].toUpperCase() : 'P';

    return Drawer(
      backgroundColor: Colors.white,
      child: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 20, 20, 16),
              child: Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppColors.purple.withValues(alpha: 0.12),
                    backgroundImage: (user?.photoURL ?? '').trim().isNotEmpty
                        ? NetworkImage(user!.photoURL!)
                        : null,
                    child: (user?.photoURL ?? '').trim().isEmpty
                        ? Text(
                            initial,
                            style: const TextStyle(
                              color: AppColors.purpleDark,
                              fontWeight: FontWeight.w800,
                            ),
                          )
                        : null,
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w800,
                            color: AppColors.navy,
                          ),
                        ),
                        if (email.isNotEmpty && name.isNotEmpty) ...[
                          const SizedBox(height: 2),
                          Text(
                            email,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              color: AppColors.muted,
                              fontSize: 12,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const Divider(height: 1),
            const SizedBox(height: 8),
            ...[...bottomNavDestinations, ...drawerNavDestinations].map((item) {
              final isSelected = item.id == selected;
              return ListTile(
                selected: isSelected,
                selectedTileColor: AppColors.purple.withValues(alpha: 0.08),
                leading: Icon(
                  isSelected ? item.selectedIcon : item.icon,
                  color: isSelected ? AppColors.purpleDark : AppColors.muted,
                ),
                title: Text(
                  item.label,
                  style: TextStyle(
                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                    color: isSelected ? AppColors.navy : AppColors.muted,
                  ),
                ),
                onTap: () {
                  Navigator.of(context).maybePop();
                  onSelect(item.id);
                },
              );
            }),
            const Spacer(),
            const Divider(height: 1),
            ListTile(
              leading: const Icon(Icons.logout, color: AppColors.muted),
              title: const Text(
                'Sign out',
                style: TextStyle(
                  fontWeight: FontWeight.w700,
                  color: AppColors.navy,
                ),
              ),
              onTap: () async {
                Navigator.of(context).maybePop();
                await AuthService.instance.signOut();
              },
            ),
            const SizedBox(height: 8),
          ],
        ),
      ),
    );
  }
}
