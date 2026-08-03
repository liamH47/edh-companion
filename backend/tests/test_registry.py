import re

from app.cards.registry import get_card, list_cards

_UUID = re.compile(r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$")


def test_list_cards_includes_registered_card() -> None:
    ids = {card.id for card in list_cards()}
    assert "aetherflux-reservoir" in ids
    assert "craterhoof-behemoth" in ids
    assert "brain-freeze" in ids
    assert "comet-stellar-pup" in ids
    assert "ob-nixilis-the-fallen" in ids


def test_list_cards_declares_a_unique_id_per_card() -> None:
    # REGISTRY is keyed by id, so a duplicate would silently drop a card instead of
    # failing loudly at import time.
    cards = list_cards()
    assert len({card.id for card in cards}) == len(cards)


def test_get_card_returns_registered_card_for_known_id() -> None:
    registered = get_card("aetherflux-reservoir")
    assert registered is not None
    assert registered.metadata.name == "Aetherflux Reservoir"


def test_get_card_returns_craterhoof_behemoth_for_its_id() -> None:
    registered = get_card("craterhoof-behemoth")
    assert registered is not None
    assert registered.metadata.name == "Craterhoof Behemoth"


def test_get_card_returns_none_for_unknown_id() -> None:
    assert get_card("nonexistent-card") is None


def test_every_card_carries_a_scryfall_id() -> None:
    # The "View card" button renders only when this is set, so a card added without one
    # loses the image silently rather than failing. The schema keeps it optional on
    # purpose -- a future entry could be a format mechanic (commander tax) with no card
    # behind it -- which is exactly why the registry needs its own check.
    missing = [card.id for card in list_cards() if not card.scryfall_id]
    assert not missing, f"cards with no Scryfall id: {missing}"


def test_every_scryfall_id_is_a_uuid() -> None:
    # A card name or Scryfall page URL pasted in by mistake would still be truthy above,
    # then 404 at image load. Cheap to catch here instead.
    malformed = [
        f"{card.id}={card.scryfall_id!r}"
        for card in list_cards()
        if card.scryfall_id and not _UUID.match(card.scryfall_id)
    ]
    assert not malformed, f"malformed Scryfall ids: {malformed}"
