"""Anthropic model tiers: fast (cheap) vs heavy (capable)."""

from __future__ import annotations

from typing import Literal

from config import settings

ModelTier = Literal["fast", "heavy"]

# Default Haiku-class model when ANTHROPIC_MODEL_FAST is unset.
_DEFAULT_FAST = "claude-haiku-4-5-20251001"


def model_for_tier(tier: ModelTier) -> str:
    if tier == "heavy":
        return settings.anthropic_model
    fast = (settings.anthropic_model_fast or "").strip()
    return fast or _DEFAULT_FAST


def is_heavy_model(model: str) -> bool:
    return model.strip() == settings.anthropic_model.strip()
