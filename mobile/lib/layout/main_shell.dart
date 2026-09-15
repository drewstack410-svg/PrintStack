import 'package:flutter/material.dart';

import '../layout/app_shell.dart';
import '../layout/nav_destinations.dart';
import '../location/location_page.dart';
import '../pages/account_page.dart';
import '../pages/history_page.dart';
import '../pages/home_page.dart';
import '../pages/print_page.dart';

/// Top-level authenticated navigation host (bottom nav + sidebar).
class MainShell extends StatefulWidget {
  const MainShell({super.key});

  @override
  State<MainShell> createState() => _MainShellState();
}

class _MainShellState extends State<MainShell> {
  AppNavId _selected = AppNavId.home;

  String get _title => switch (_selected) {
        AppNavId.home => 'Home',
        AppNavId.print => 'Print',
        AppNavId.history => 'History',
        AppNavId.location => 'Location',
        AppNavId.account => 'Account',
      };

  @override
  Widget build(BuildContext context) {
    return AppShell(
      selected: _selected,
      onSelect: (id) => setState(() => _selected = id),
      title: _title,
      body: switch (_selected) {
        AppNavId.home => HomePage(
            onOpenPrint: () => setState(() => _selected = AppNavId.print),
            onOpenHistory: () => setState(() => _selected = AppNavId.history),
          ),
        AppNavId.print => const PrintPage(),
        AppNavId.history => const HistoryPage(),
        AppNavId.location => const LocationPage(),
        AppNavId.account => const AccountPage(),
      },
    );
  }
}
