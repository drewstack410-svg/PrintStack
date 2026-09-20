import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';

import '../components/brand/brand_wordmark.dart';
import '../layout/main_shell.dart';
import '../pages/login_page.dart';
import '../pages/register_page.dart';
import '../theme.dart';
import 'auth_service.dart';

class AuthGate extends StatelessWidget {
  const AuthGate({super.key});

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<User?>(
      stream: AuthService.instance.authStateChanges,
      builder: (context, snapshot) {
        if (snapshot.connectionState == ConnectionState.waiting) {
          return const _LaunchScreen();
        }

        final user = snapshot.data;
        if (user == null) {
          return const AuthLanding();
        }

        return _RoleGate(user: user);
      },
    );
  }
}

class _RoleGate extends StatefulWidget {
  const _RoleGate({required this.user});

  final User user;

  @override
  State<_RoleGate> createState() => _RoleGateState();
}

class _RoleGateState extends State<_RoleGate> {
  late Future<String> _roleFuture;

  @override
  void initState() {
    super.initState();
    _roleFuture = AuthService.instance.loadRole(widget.user);
  }

  @override
  void didUpdateWidget(covariant _RoleGate oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.user.uid != widget.user.uid) {
      _roleFuture = AuthService.instance.loadRole(widget.user);
    }
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<String>(
      future: _roleFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _LaunchScreen();
        }

        final role = snapshot.data ?? AuthService.customerRole;
        if (AuthService.instance.isElevatedRole(role)) {
          return _ElevatedRoleBlocked(role: role);
        }

        return const MainShell();
      },
    );
  }
}

class _ElevatedRoleBlocked extends StatelessWidget {
  const _ElevatedRoleBlocked({required this.role});

  final String role;

  @override
  Widget build(BuildContext context) {
    final label = role == 'superadmin' || role == 'admin'
        ? 'Admin and superadmin accounts can only sign in on the Printstack desktop app.'
        : 'This account cannot use the customer mobile app.';

    return Scaffold(
      backgroundColor: AppColors.mist,
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const BrandWordmark(size: 28),
              const SizedBox(height: 24),
              Text(
                'Wrong app for this account',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: AppColors.navy,
                    ),
              ),
              const SizedBox(height: 12),
              Text(
                label,
                textAlign: TextAlign.center,
                style: const TextStyle(color: AppColors.muted, height: 1.4),
              ),
              const SizedBox(height: 24),
              FilledButton(
                onPressed: () => AuthService.instance.signOut(),
                child: const Text('Sign out'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class AuthLanding extends StatefulWidget {
  const AuthLanding({super.key});

  @override
  State<AuthLanding> createState() => _AuthLandingState();
}

class _AuthLandingState extends State<AuthLanding> {
  bool _register = false;

  @override
  Widget build(BuildContext context) {
    if (_register) {
      return RegisterPage(onSignIn: () => setState(() => _register = false));
    }
    return LoginPage(onRegister: () => setState(() => _register = true));
  }
}

class _LaunchScreen extends StatelessWidget {
  const _LaunchScreen();

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      backgroundColor: AppColors.mist,
      body: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            BrandWordmark(size: 34),
            SizedBox(height: 24),
            CircularProgressIndicator(),
          ],
        ),
      ),
    );
  }
}
