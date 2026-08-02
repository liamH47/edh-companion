from app.cards.storm import total_copies


def test_total_copies_counts_the_original_spell_when_storm_count_is_zero() -> None:
    # No spells cast before it: no copies, but the spell itself still resolves once.
    assert total_copies(0) == 1


def test_total_copies_adds_one_copy_per_preceding_spell() -> None:
    assert total_copies(1) == 2
    assert total_copies(5) == 6
