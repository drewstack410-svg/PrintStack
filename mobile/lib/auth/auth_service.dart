import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/foundation.dart';
import 'package:google_sign_in/google_sign_in.dart';

const _webClientId =
    '445834428378-v1ktsk6ovoreo12ie9ioel7ubljd18i9.apps.googleusercontent.com';
const _iosClientId =
    '445834428378-vlh6dopb9eiha27284o1ldm5qd9bg7el.apps.googleusercontent.com';

class AuthFailure implements Exception {
  const AuthFailure(this.message);
  final String message;
}

class AuthCanceled implements Exception {
  const AuthCanceled();
}

class AuthService {
  AuthService({FirebaseAuth? auth, FirebaseFirestore? firestore})
    : _auth = auth ?? FirebaseAuth.instance,
      _firestore = firestore ?? FirebaseFirestore.instance;

  static final AuthService instance = AuthService();

  final FirebaseAuth _auth;
  final FirebaseFirestore _firestore;
  Future<void>? _googleInit;

  Stream<User?> get authStateChanges => _auth.authStateChanges();
  User? get currentUser => _auth.currentUser;

  Future<void> signInWithEmail({
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.signInWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      await ensureUserDocument(credential.user!);
    } on FirebaseAuthException catch (error) {
      throw AuthFailure(_messageFor(error));
    }
  }

  Future<void> registerWithEmail({
    required String firstName,
    required String lastName,
    required String email,
    required String password,
  }) async {
    try {
      final credential = await _auth.createUserWithEmailAndPassword(
        email: email.trim(),
        password: password,
      );
      final user = credential.user!;
      final displayName = [firstName.trim(), lastName.trim()]
          .where((part) => part.isNotEmpty)
          .join(' ');
      if (displayName.isNotEmpty) {
        await user.updateDisplayName(displayName);
      }
      await ensureUserDocument(
        user,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      );
    } on FirebaseAuthException catch (error) {
      throw AuthFailure(_messageFor(error));
    }
  }

  Future<void> signInWithGoogle() async {
    try {
      await _ensureGoogleInitialized();
      final googleUser = await GoogleSignIn.instance.authenticate();
      final idToken = googleUser.authentication.idToken;
      if (idToken == null) {
        throw const AuthFailure('Google did not return an ID token.');
      }
      final credential = await _auth.signInWithCredential(
        GoogleAuthProvider.credential(idToken: idToken),
      );
      await ensureUserDocument(credential.user!);
    } on AuthFailure {
      rethrow;
    } on GoogleSignInException catch (error) {
      if (error.code == GoogleSignInExceptionCode.canceled ||
          error.code == GoogleSignInExceptionCode.interrupted) {
        throw const AuthCanceled();
      }
      throw AuthFailure(_googleMessage(error));
    } on FirebaseAuthException catch (error) {
      throw AuthFailure(_messageFor(error));
    }
  }

  Future<void> sendPasswordReset(String email) async {
    try {
      await _auth.sendPasswordResetEmail(email: email.trim());
    } on FirebaseAuthException catch (error) {
      throw AuthFailure(_messageFor(error));
    }
  }

  Future<void> signOut() async {
    try {
      if (_googleInit != null) {
        await GoogleSignIn.instance.signOut();
      }
    } catch (_) {}
    await _auth.signOut();
  }

  Future<void> ensureUserDocument(
    User user, {
    String? firstName,
    String? lastName,
  }) async {
    try {
      await _writeUserDocument(
        user,
        firstName: firstName,
        lastName: lastName,
      );
    } catch (error) {
      debugPrint('Could not write user profile: $error');
    }
  }

  Future<void> _writeUserDocument(
    User user, {
    String? firstName,
    String? lastName,
  }) async {
    final names = _namesFrom(user, firstName: firstName, lastName: lastName);
    final ref = _firestore.collection('users').doc(user.uid);
    final snap = await ref.get();

    if (!snap.exists) {
      await ref.set({
        'uid': user.uid,
        'email': user.email ?? '',
        'firstName': names.$1,
        'middleName': '',
        'lastName': names.$2,
        'photoUrl': user.photoURL ?? '',
        'role': 'user',
        'createdAt': FieldValue.serverTimestamp(),
        'updatedAt': FieldValue.serverTimestamp(),
      });
      return;
    }

    final data = snap.data() ?? {};
    final updates = <String, dynamic>{
      'email': user.email ?? data['email'] ?? '',
      'updatedAt': FieldValue.serverTimestamp(),
    };
    if (_isBlank(data['firstName']) && names.$1.isNotEmpty) {
      updates['firstName'] = names.$1;
    }
    if (_isBlank(data['lastName']) && names.$2.isNotEmpty) {
      updates['lastName'] = names.$2;
    }
    if (_isBlank(data['photoUrl']) && (user.photoURL ?? '').isNotEmpty) {
      updates['photoUrl'] = user.photoURL;
    }
    await ref.set(updates, SetOptions(merge: true));
  }

  Future<void> _ensureGoogleInitialized() {
    return _googleInit ??= GoogleSignIn.instance.initialize(
      clientId: !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS
          ? _iosClientId
          : null,
      serverClientId: _webClientId,
    );
  }

  (String, String) _namesFrom(
    User user, {
    String? firstName,
    String? lastName,
  }) {
    if ((firstName ?? '').trim().isNotEmpty ||
        (lastName ?? '').trim().isNotEmpty) {
      return ((firstName ?? '').trim(), (lastName ?? '').trim());
    }
    final parts = (user.displayName ?? '')
        .trim()
        .split(RegExp(r'\s+'))
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) {
      return ('', '');
    }
    return (parts.first, parts.skip(1).join(' '));
  }

  bool _isBlank(dynamic value) => value == null || value.toString().trim().isEmpty;

  String _googleMessage(GoogleSignInException error) {
    switch (error.code) {
      case GoogleSignInExceptionCode.clientConfigurationError:
        return 'Google Sign-In is not configured for this app yet.';
      case GoogleSignInExceptionCode.providerConfigurationError:
        return 'Google sign-in is not enabled for this Firebase project.';
      case GoogleSignInExceptionCode.uiUnavailable:
        return 'Google Sign-In is unavailable right now. Try again.';
      default:
        return error.description ?? 'Could not sign in with Google.';
    }
  }

  String _messageFor(FirebaseAuthException error) {
    switch (error.code) {
      case 'invalid-credential':
      case 'wrong-password':
      case 'user-not-found':
        return 'Email or password is incorrect.';
      case 'too-many-requests':
        return 'Too many attempts. Try again in a few minutes.';
      case 'operation-not-allowed':
        return 'This sign-in method is not enabled for this Firebase project.';
      case 'missing-email':
      case 'invalid-email':
        return 'Enter a valid email first.';
      case 'email-already-in-use':
        return 'That email already has an account.';
      case 'weak-password':
        return 'Password must be at least 6 characters.';
      case 'network-request-failed':
        return 'Check your internet connection and try again.';
      case 'account-exists-with-different-credential':
        return 'An account already exists with this email. Sign in another way.';
      default:
        return error.message ?? 'Could not complete that request.';
    }
  }
}
