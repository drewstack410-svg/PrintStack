import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../theme.dart';
import '../widgets/auth_widgets.dart';

class LoginPage extends StatefulWidget {
  const LoginPage({super.key, this.onRegister});

  final VoidCallback? onRegister;

  @override
  State<LoginPage> createState() => _LoginPageState();
}

class _LoginPageState extends State<LoginPage> {
  final _formKey = GlobalKey<FormState>();
  final _email = TextEditingController();
  final _password = TextEditingController();
  bool _obscure = true;
  bool _busy = false;
  bool _googleBusy = false;
  String? _error;
  String? _info;

  @override
  void dispose() {
    _email.dispose();
    _password.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
      _info = null;
    });
    try {
      await AuthService.instance.signInWithEmail(
        email: _email.text,
        password: _password.text,
      );
    } on AuthFailure catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _google() async {
    setState(() {
      _googleBusy = true;
      _error = null;
      _info = null;
    });
    try {
      await AuthService.instance.signInWithGoogle();
    } on AuthCanceled {
      // User closed the Google sheet.
    } on AuthFailure catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    } finally {
      if (mounted) {
        setState(() => _googleBusy = false);
      }
    }
  }

  Future<void> _forgotPassword() async {
    final email = _email.text.trim();
    if (email.isEmpty || !email.contains('@')) {
      setState(() => _error = 'Enter a valid email first.');
      return;
    }
    setState(() {
      _error = null;
      _info = null;
    });
    try {
      await AuthService.instance.sendPasswordReset(email);
      if (mounted) {
        setState(() => _info = 'Password reset email sent.');
      }
    } on AuthFailure catch (error) {
      if (mounted) {
        setState(() => _error = error.message);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final locked = _busy || _googleBusy;

    return AuthScaffold(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const BrandWordmark(),
            const SizedBox(height: 28),
            ShaderMask(
              shaderCallback: (bounds) =>
                  AppTheme.brandGradient.createShader(bounds),
              child: const Text(
                'Welcome back',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Sign in to PrintStack',
              style: TextStyle(color: AppColors.muted, fontSize: 16),
            ),
            const SizedBox(height: 24),
            if (_error != null) MessageBanner(message: _error!, isError: true),
            if (_info != null) MessageBanner(message: _info!),
            TextFormField(
              controller: _email,
              keyboardType: TextInputType.emailAddress,
              textInputAction: TextInputAction.next,
              autofillHints: const [AutofillHints.email],
              validator: (value) {
                final email = value?.trim() ?? '';
                if (email.isEmpty || !email.contains('@')) {
                  return 'Enter a valid email';
                }
                return null;
              },
              decoration: const InputDecoration(labelText: 'Email'),
            ),
            const SizedBox(height: 14),
            PasswordField(
              controller: _password,
              obscure: _obscure,
              onToggle: () => setState(() => _obscure = !_obscure),
              validator: (value) {
                if ((value ?? '').isEmpty) {
                  return 'Password is required';
                }
                return null;
              },
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Sign in',
              busy: _busy,
              onPressed: locked ? null : _submit,
            ),
            const SizedBox(height: 8),
            TextButton(
              onPressed: locked ? null : _forgotPassword,
              child: const Text(
                'Forgot password?',
                style: TextStyle(
                  color: AppColors.purple,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ),
            const SizedBox(height: 8),
            const Row(
              children: [
                Expanded(child: Divider()),
                Padding(
                  padding: EdgeInsets.symmetric(horizontal: 12),
                  child: Text('or', style: TextStyle(color: AppColors.muted)),
                ),
                Expanded(child: Divider()),
              ],
            ),
            const SizedBox(height: 16),
            GoogleSignInButton(busy: _googleBusy, onPressed: locked ? null : _google),
            const SizedBox(height: 28),
            Wrap(
              alignment: WrapAlignment.center,
              children: [
                const Text(
                  "Don't have an account? ",
                  style: TextStyle(color: AppColors.muted),
                ),
                GestureDetector(
                  onTap: locked ? null : widget.onRegister,
                  child: const Text(
                    'Register',
                    style: TextStyle(
                      color: AppColors.purple,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
