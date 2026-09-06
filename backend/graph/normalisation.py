"""Concept name normalisation.

`normalized_name` is half of a concept's identity key - `(note_id,
normalized_name)` - so this function decides which two concepts are "the same
concept" within a note. It is deliberately pure and boring: deterministic
rules only, no fuzzy matching. Anything cleverer belongs behind a SIMILAR_TO
relationship where a wrong call can be undone, not in an identity key where it
silently merges two ideas.

The LLM emits concept names in snake_case per the prompt template in
backend/ai/ai.py, but users typing a manual node emit whatever they selected in
the editor. Both paths land here.
"""

import re

_WHITESPACE = re.compile(r"\s+")
# Keep letters, digits and internal spaces. Punctuation is noise for identity
# purposes: "photosynthesis." and "photosynthesis" are the same concept.
_PUNCTUATION = re.compile(r"[^\w\s]", re.UNICODE)


def normalise_concept_name(raw: str) -> str:
    """Reduce a concept name to its identity form.

    lowercase, underscores and hyphens to spaces, punctuation stripped,
    whitespace collapsed:

        "Photosynthesis"          -> "photosynthesis"
        "photosynthesis_process"  -> "photosynthesis process"
        "  The   Calvin-Cycle. "  -> "the calvin cycle"

    Returns "" for input that normalises away entirely, which callers must
    treat as an unusable concept rather than storing under an empty key.
    """
    if not raw:
        return ""

    text = raw.replace("_", " ").replace("-", " ")
    text = _PUNCTUATION.sub("", text)
    text = _WHITESPACE.sub(" ", text)
    return text.strip().lower()


def humanise(raw: str) -> str:
    """Turn a stored or LLM-emitted name into a display label.

    Mirrors `_humanise` in routers/ai_adapter.py, which does the same job for
    the generate path. Kept separate from normalisation because display and
    identity have different rules - display preserves the caller's casing and
    punctuation, identity does not.
    """
    return (raw or "").replace("_", " ").strip()
