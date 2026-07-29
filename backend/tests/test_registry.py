from app.cards.registry import get_card, list_cards


def test_list_cards_includes_registered_card() -> None:
    ids = {card.id for card in list_cards()}
    assert "aetherflux-reservoir" in ids


def test_get_card_returns_registered_card_for_known_id() -> None:
    registered = get_card("aetherflux-reservoir")
    assert registered is not None
    assert registered.metadata.name == "Aetherflux Reservoir"


def test_get_card_returns_none_for_unknown_id() -> None:
    assert get_card("nonexistent-card") is None
