"""Generates the golden corpus that proves the TypeScript card port matches Python.

Python is the source of truth for card behaviour. This walks every registered card,
feeds it a mechanically-derived set of inputs, and records what `validate_inputs` +
`compute` produced. `packages/core/src/cards/parity.test.ts` replays the same inputs
through the TypeScript implementation and asserts the same answers.

Deliberately outside `backend/app/` so the 100%-coverage gate does not demand tests for
a developer tool, and deliberately containing **no card-specific logic**: it reads
`FieldSpec` and reports. The risk in a dumb generator is case *selection*, not
correctness, which is what `_interesting_values` and `EXTRA_CASES` address.

Case selection is fully deterministic -- no sampling, no RNG. A generator that sampled
would rewrite every file on each run, which would destroy the property that makes
`--check` meaningful: that a diff means the *behaviour* changed.

    uv run python tools/generate_parity_corpus.py           # write
    uv run python tools/generate_parity_corpus.py --check    # fail if stale (CI)
"""

from __future__ import annotations

import argparse
import itertools
import json
import sys
from pathlib import Path
from typing import Any

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.cards.registry import get_card, list_cards  # noqa: E402
from app.cards.schema import CardMetadata, FieldKind, FieldSpec  # noqa: E402
from app.cards.validation import InputError, validate_inputs  # noqa: E402

NEWLINE = chr(10)

CARDS_DIR = Path(__file__).resolve().parents[2] / "packages" / "core" / "src" / "cards"
CORPUS_DIR = CARDS_DIR / "__parity__"
METADATA_PATH = CARDS_DIR / "metadata.generated.json"

# Sequences have no natural "interesting values" -- their space is every ordering of
# every length -- so the ones that matter are named per card.
EXTRA_SEQUENCES: dict[str, list[list[str]]] = {
    "comet-stellar-pup": [
        [],
        ["1"],
        ["6"],
        # A 6 then a damage roll: the damage is loyalty *before* the -2, and the 6
        # already moved it. This is the ordering the card is easiest to get wrong on.
        ["6", "4"],
        ["6", "5"],
        # Four 6s buy exactly enough activations to reach every other face.
        ["6", "6", "6", "6", "1", "2", "3", "4", "5"],
        # Kills Comet mid-sequence; everything logged after it never happened.
        ["3", "3", "3", "3", "3", "3"],
        # Over the declared cap.
        ["1"] * 41,
    ],
}

# Board states worth pinning that a mechanical sweep would not reach.
EXTRA_CASES: dict[str, list[dict[str, Any]]] = {
    "aetherflux-reservoir": [
        # Exactly at the 50-life threshold the action guard keys on.
        {"starting_life": 50, "spells_already_cast": 0, "spells_cast_this_turn": 0},
    ],
    "scute-swarm": [
        # The six-land flip, one land either side of it.
        {
            "current_land_count": 5,
            "scute_swarm_count": 1,
            "insect_token_count": 0,
            "lands_played": 1,
        },
        {
            "current_land_count": 6,
            "scute_swarm_count": 1,
            "insect_token_count": 0,
            "lands_played": 1,
        },
        # The configuration this card originally shipped with. Now rejected by its
        # bounds, and worth keeping so the corpus pins that both implementations refuse
        # it identically rather than one of them quietly computing 2^129.
        {
            "current_land_count": 6,
            "scute_swarm_count": 999_999_999,
            "insect_token_count": 0,
            "lands_played": 99,
        },
    ],
}


def _interesting_values(field: FieldSpec) -> list[Any]:
    """Values worth trying for one field, derived from its own spec.

    Bounds and the values just outside them, because that is where off-by-one lives;
    the default, because that is what most users actually send.
    """
    if field.kind is FieldKind.BOOLEAN:
        return [True, False]

    if field.kind is FieldKind.SELECT:
        return [option.value for option in field.options or []]

    if field.kind is FieldKind.SEQUENCE:
        return []  # handled by EXTRA_SEQUENCES

    values: list[Any] = [field.default]
    if field.min is not None:
        values += [field.min, field.min - 1]
    if field.max is not None:
        values += [field.max, field.max + 1]
    # Dedupe while preserving order, so regenerating is stable.
    return list(dict.fromkeys(values))


def _cases_for(card: CardMetadata) -> list[dict[str, Any]]:
    scalar_fields = [f for f in card.fields if f.kind is not FieldKind.SEQUENCE]
    sequence_fields = [f for f in card.fields if f.kind is FieldKind.SEQUENCE]

    axes = [_interesting_values(f) for f in scalar_fields]
    combos = itertools.product(*axes) if axes else [()]

    cases: list[dict[str, Any]] = []
    for combo in combos:
        base = dict(zip((f.name for f in scalar_fields), combo, strict=True))
        if not sequence_fields:
            cases.append(base)
            continue
        # One sequence per card in practice; the product keeps it general.
        for seq_combo in itertools.product(
            *(EXTRA_SEQUENCES.get(card.id, [[]]) for _ in sequence_fields)
        ):
            cases.append(
                {**base, **dict(zip((f.name for f in sequence_fields), seq_combo, strict=True))}
            )

    for extra in EXTRA_CASES.get(card.id, []):
        cases.append(extra)
    return cases


def _record(card: CardMetadata, inputs: dict[str, Any]) -> dict[str, Any]:
    """Runs one case, recording either the outputs or the validation failure."""
    try:
        validated = validate_inputs(card.fields, inputs)
    except InputError as error:
        return {"inputs": inputs, "error": {"field": error.field, "code": error.code}}
    module = get_card(card.id)
    return {"inputs": inputs, "outputs": module.compute(validated)}


def build_corpus(card: CardMetadata) -> dict[str, Any]:
    return {
        "cardId": card.id,
        "generatedFrom": f"backend/app/cards/{card.id.replace('-', '_')}.py",
        "note": "Generated by backend/tools/generate_parity_corpus.py. Do not edit by hand.",
        "cases": [_record(card, inputs) for inputs in _cases_for(card)],
    }


def render(card: CardMetadata) -> str:
    # Sorted keys and a trailing newline so a diff shows a behaviour change rather than
    # dict ordering noise.
    return json.dumps(build_corpus(card), indent=2, sort_keys=True) + "\n"


def render_metadata() -> str:
    """The card metadata, byte-identical to what `GET /api/cards` returns.

    Generated rather than hand-written in TypeScript for the same reason as the corpus:
    Python owns what a card *is*, and a second hand-maintained copy would drift.
    """
    payload = [card.model_dump(mode="json") for card in list_cards()]
    return json.dumps(payload, indent=2, sort_keys=True) + NEWLINE


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--check", action="store_true", help="fail if any file is stale")
    args = parser.parse_args()

    CORPUS_DIR.mkdir(parents=True, exist_ok=True)
    stale: list[str] = []

    metadata = render_metadata()
    if args.check:
        existing = METADATA_PATH.read_text(encoding="utf-8") if METADATA_PATH.exists() else ""
        if existing != metadata:
            stale.append("metadata.generated.json")
    else:
        METADATA_PATH.write_text(metadata, encoding="utf-8", newline=NEWLINE)

    for card in list_cards():
        path = CORPUS_DIR / f"{card.id}.json"
        rendered = render(card)
        if args.check:
            existing = path.read_text(encoding="utf-8") if path.exists() else ""
            if existing != rendered:
                stale.append(card.id)
        else:
            path.write_text(rendered, encoding="utf-8", newline="\n")

    if args.check:
        if stale:
            print(
                "Parity corpus is stale for: "
                + ", ".join(stale)
                + "\nRun: uv run python tools/generate_parity_corpus.py",
                file=sys.stderr,
            )
            return 1
        print(f"Parity corpus and metadata are up to date ({len(list_cards())} cards).")
    else:
        print(f"Wrote metadata + {len(list_cards())} corpus files to {CARDS_DIR}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
