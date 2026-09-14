import 'package:flutter/material.dart';

class MessageBanner extends StatelessWidget {
  const MessageBanner({
    super.key,
    required this.message,
    this.isError = false,
  });

  final String message;
  final bool isError;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: isError ? const Color(0xFFFFEBEE) : const Color(0xFFE8F5E9),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Text(
            message,
            style: TextStyle(
              color: isError ? const Color(0xFFB71C1C) : const Color(0xFF1B5E20),
            ),
          ),
        ),
      ),
    );
  }
}
