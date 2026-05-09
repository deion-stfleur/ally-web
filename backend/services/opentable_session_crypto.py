"""Encrypt OpenTable session blobs at rest (key derived from JWT_SECRET)."""

from __future__ import annotations

from services.google_token_crypto import decrypt_refresh_token, encrypt_refresh_token


def encrypt_opentable_session(blob_json: str | None) -> str | None:
    return encrypt_refresh_token(blob_json)


def decrypt_opentable_session(ciphertext: str | None) -> str | None:
    return decrypt_refresh_token(ciphertext)

