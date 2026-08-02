from app.cards.registry import get_card, list_cards


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
