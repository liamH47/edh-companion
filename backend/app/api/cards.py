"""HTTP surface for the card registry: list cards, fetch one, run its calculation."""

from typing import Any

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from ..cards.registry import RegisteredCard, get_card, list_cards
from ..cards.schema import CardMetadata
from ..cards.validation import validate_inputs

router = APIRouter(prefix="/api/cards", tags=["cards"])


class CalculateRequest(BaseModel):
    inputs: dict[str, Any]


class CalculateResponse(BaseModel):
    outputs: dict[str, Any]


def _get_registered_card_or_404(card_id: str) -> RegisteredCard:
    card = get_card(card_id)
    if card is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail=f"Unknown card: {card_id!r}"
        )
    return card


@router.get("", response_model=list[CardMetadata])
def get_cards() -> list[CardMetadata]:
    return list_cards()


@router.get("/{card_id}", response_model=CardMetadata)
def get_card_metadata(card_id: str) -> CardMetadata:
    return _get_registered_card_or_404(card_id).metadata


@router.post("/{card_id}/calculate", response_model=CalculateResponse)
def calculate(card_id: str, request: CalculateRequest) -> CalculateResponse:
    card = _get_registered_card_or_404(card_id)
    try:
        validated_inputs = validate_inputs(card.metadata.fields, request.inputs)
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail=str(exc)
        ) from exc
    return CalculateResponse(outputs=card.compute(validated_inputs))
