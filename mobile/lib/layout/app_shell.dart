import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../theme.dart';
import 'app_sidebar.dart';
import 'nav_destinations.dart';

class AppShell extends StatelessWidget {
  const AppShell({
    super.key,
    required this.selected,
    required this.onSelect,
    required this.title,
    required this.body,
    this.actions,
  });

  final AppNavId selected;
  final ValueChanged<AppNavId> onSelect;
  final String title;
  final Widget body;
  final List<Widget>? actions;

  @override
  Widget build(BuildContext context) {
    final bottomId = switch (selected) {
      AppNavId.account || AppNavId.location => AppNavId.home,
      _ => selected,
    };
    final printSelected = bottomId == AppNavId.print;

    return Scaffold(
      appBar: AppBar(
        backgroundColor: AppColors.barDark,
        foregroundColor: Colors.white,
        title: Text(title),
        actions: [
          ...?actions,
          Padding(
            padding: const EdgeInsets.only(right: 12),
            child: _AppBarAvatar(
              onTap: () => onSelect(AppNavId.account),
            ),
          ),
        ],
      ),
      drawer: AppSidebar(
        selected: selected,
        onSelect: onSelect,
      ),
      body: body,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      floatingActionButton: _PrintFab(
        selected: printSelected,
        onTap: () => onSelect(AppNavId.print),
      ),
      bottomNavigationBar: BottomAppBar(
        color: AppColors.barDark,
        shape: const CircularNotchedRectangle(),
        notchMargin: 8,
        elevation: 10,
        padding: EdgeInsets.zero,
        height: 64,
        child: Row(
          children: [
            Expanded(
              child: _NavItem(
                destination: bottomNavDestinations[0],
                selected: bottomId == AppNavId.home,
                onTap: () => onSelect(AppNavId.home),
              ),
            ),
            const Spacer(),
            Expanded(
              child: _NavItem(
                destination: bottomNavDestinations[2],
                selected: bottomId == AppNavId.history,
                onTap: () => onSelect(AppNavId.history),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _AppBarAvatar extends StatelessWidget {
  const _AppBarAvatar({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final user = FirebaseAuth.instance.currentUser;
    final name = (user?.displayName ?? user?.email ?? 'P').trim();
    final initial = name.isNotEmpty ? name[0].toUpperCase() : 'P';
    final photo = (user?.photoURL ?? '').trim();

    return InkWell(
      customBorder: const CircleBorder(),
      onTap: onTap,
      child: CircleAvatar(
        radius: 16,
        backgroundColor: Colors.white.withValues(alpha: 0.18),
        backgroundImage: photo.isNotEmpty ? NetworkImage(photo) : null,
        child: photo.isEmpty
            ? Text(
                initial,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                  fontSize: 13,
                ),
              )
            : null,
      ),
    );
  }
}

class _NavItem extends StatelessWidget {
  const _NavItem({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final AppNavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final color = selected ? Colors.white : const Color(0xFF9AA3B5);

    return InkWell(
      onTap: onTap,
      splashColor: Colors.white12,
      highlightColor: Colors.white10,
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(
            selected ? destination.selectedIcon : destination.icon,
            color: color,
            size: 24,
          ),
          const SizedBox(height: 4),
          Text(
            destination.label,
            style: TextStyle(
              fontSize: 12,
              fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              color: color,
            ),
          ),
        ],
      ),
    );
  }
}

class _PrintFab extends StatelessWidget {
  const _PrintFab({
    required this.selected,
    required this.onTap,
  });

  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 72,
      height: 72,
      child: Material(
        elevation: selected ? 10 : 6,
        shadowColor: AppColors.purple.withValues(alpha: 0.55),
        shape: const CircleBorder(),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          customBorder: const CircleBorder(),
          onTap: onTap,
          child: Ink(
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              gradient: AppTheme.brandGradient,
              border: Border.all(
                color: Colors.white,
                width: selected ? 3.5 : 3,
              ),
            ),
            child: const Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.print_rounded, color: Colors.white, size: 24),
                SizedBox(height: 2),
                Text(
                  'Print',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w800,
                    height: 1,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
