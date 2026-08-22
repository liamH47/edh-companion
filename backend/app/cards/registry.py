"""Central place every card gets wired up. Add a card: write a module, list it below."""

from dataclasses import dataclass
from types import ModuleType
from typing import Any, Protocol

from . import (
    aetherflux_reservoir,
    brain_freeze,
    comet_stellar_pup,
    commander_tax,
    craterhoof_behemoth,
    dungeons,
    empty_the_warrens,
    grapeshot,
    kalonian_hydra,
    landfall,
    mana_pool,
    nykthos_shrine_to_nyx,
    ob_nixilis_the_fallen,
    scute_swarm,
    storm_payoffs,
    tendrils_of_agony,
)
from .schema import CardMetadata

# Add new card modules here — explicit, not pkgutil-scanned, so a missing card
# shows up as a one-line diff to review instead of an import-order mystery.
_MODULES: list[ModuleType] = [
    aetherflux_reservoir,
    brain_freeze,
    comet_stellar_pup,
    commander_tax,
    craterhoof_behemoth,
    dungeons,
    empty_the_warrens,
    grapeshot,
    kalonian_hydra,
    landfall,
    mana_pool,
    nykthos_shrine_to_nyx,
    ob_nixilis_the_fallen,
    scute_swarm,
    storm_payoffs,
    tendrils_of_agony,
]


class CardCompute(Protocol):
    def __call__(self, inputs: dict[str, Any]) -> dict[str, Any]: ...


@dataclass(frozen=True, slots=True)
class RegisteredCard:
    """Pairs a card's metadata with its compute function.

    A dataclass, not a Pydantic BaseModel: built once at import time from
    trusted code and never (de)serialized, so validation would buy nothing.
    """

    metadata: CardMetadata
    compute: CardCompute


REGISTRY: dict[str, RegisteredCard] = {
    module.METADATA.id: RegisteredCard(metadata=module.METADATA, compute=module.compute)
    for module in _MODULES
}


def get_card(card_id: str) -> RegisteredCard | None:
    return REGISTRY.get(card_id)


def list_cards() -> list[CardMetadata]:
    return [registered.metadata for registered in REGISTRY.values()]
