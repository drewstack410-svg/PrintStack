import 'package:flutter/material.dart';

enum AppNavId { home, print, history, location, account }

class AppNavDestination {
  const AppNavDestination({
    required this.id,
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final AppNavId id;
  final String label;
  final IconData icon;
  final IconData selectedIcon;
}

/// Bottom-bar destinations (Print is rendered as the center action).
const bottomNavDestinations = [
  AppNavDestination(
    id: AppNavId.home,
    label: 'Home',
    icon: Icons.home_outlined,
    selectedIcon: Icons.home,
  ),
  AppNavDestination(
    id: AppNavId.print,
    label: 'Find shops',
    icon: Icons.print_outlined,
    selectedIcon: Icons.print,
  ),
  AppNavDestination(
    id: AppNavId.history,
    label: 'History',
    icon: Icons.history_outlined,
    selectedIcon: Icons.history,
  ),
];

/// Drawer-only destinations.
const drawerNavDestinations = [
  AppNavDestination(
    id: AppNavId.location,
    label: 'Location',
    icon: Icons.location_on_outlined,
    selectedIcon: Icons.location_on,
  ),
  AppNavDestination(
    id: AppNavId.account,
    label: 'Account',
    icon: Icons.person_outline,
    selectedIcon: Icons.person,
  ),
];
