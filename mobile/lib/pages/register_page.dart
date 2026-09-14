import 'package:flutter/material.dart';

import '../auth/auth_service.dart';
import '../theme.dart';
import '../widgets/auth_widgets.dart';

class RegisterPage extends StatefulWidget {
  const RegisterPage({super.key, this.onSignIn});

  final VoidCallback? onSignIn;

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final _formKey = GlobalKey<FormState>();
  final _firstName = TextEditingController();
  final _lastName = TextEditingController();
  final _email = TextEditingController();
  final _password = TextEditingController();
  final _confirm = TextEditingController();
  bool _obscure = true;
  bool _obscureConfirm = true;
  bool _busy = false;
  bool _googleBusy = false;
  String? _error;

  @override
  void dispose() {
    _firstName.dispose();
    _lastName.dispose();
    _email.dispose();
    _password.dispose();
    _confirm.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await AuthService.instance.registerWithEmail(
        firstName: _firstName.text,
        lastName: _lastName.text,
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

  @override
  Widget build(BuildContext context) {
    final locked = _busy || _googleBusy;

    return AuthScaffold(
      child: Form(
        key: _formKey,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: IconButton(
                onPressed: locked ? null : widget.onSignIn,
                icon: const Icon(Icons.arrow_back),
              ),
            ),
            const BrandWordmark(),
            const SizedBox(height: 28),
            ShaderMask(
              shaderCallback: (bounds) =>
                  AppTheme.brandGradient.createShader(bounds),
              child: const Text(
                'Create account',
                style: TextStyle(
                  fontSize: 32,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
            ),
            const SizedBox(height: 6),
            const Text(
              'Register to start using PrintStack',
              style: TextStyle(color: AppColors.muted, fontSize: 16),
            ),
            const SizedBox(height: 24),
            if (_error != null) MessageBanner(message: _error!, isError: true),
            Row(
              children: [
                Expanded(
                  child: TextFormField(
                    controller: _firstName,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    validator: (value) =>
                        (value ?? '').trim().isEmpty ? 'First name is required' : null,
                    decoration: const InputDecoration(labelText: 'First name'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: TextFormField(
                    controller: _lastName,
                    textInputAction: TextInputAction.next,
                    textCapitalization: TextCapitalization.words,
                    validator: (value) =>
                        (value ?? '').trim().isEmpty ? 'Last name is required' : null,
                    decoration: const InputDecoration(labelText: 'Last name'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
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
              textInputAction: TextInputAction.next,
              validator: (value) {
                if ((value ?? '').length < 6) {
                  return 'Password must be at least 6 characters';
                }
                return null;
              },
            ),
            const SizedBox(height: 14),
            PasswordField(
              controller: _confirm,
              obscure: _obscureConfirm,
              onToggle: () => setState(() => _obscureConfirm = !_obscureConfirm),
              label: 'Confirm password',
              validator: (value) {
                if (value != _password.text) {
                  return 'Passwords must match';
                }
                return null;
              },
            ),
            const SizedBox(height: 22),
            GradientButton(
              label: 'Create account',
              busy: _busy,
              onPressed: locked ? null : _submit,
            ),
            const SizedBox(height: 16),
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
                  'Already have an account? ',
                  style: TextStyle(color: AppColors.muted),
                ),
                GestureDetector(
                  onTap: locked ? null : widget.onSignIn,
                  child: const Text(
                    'Sign in',
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
