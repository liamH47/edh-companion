from fastapi.testclient import TestClient


def test_get_cards_includes_aetherflux_reservoir(client: TestClient) -> None:
    response = client.get("/api/cards")
    assert response.status_code == 200
    card_ids = {card["id"] for card in response.json()}
    assert "aetherflux-reservoir" in card_ids
    assert "craterhoof-behemoth" in card_ids
    assert "brain-freeze" in card_ids
    assert "comet-stellar-pup" in card_ids
    assert "ob-nixilis-the-fallen" in card_ids


def test_get_comet_metadata_describes_its_roll_sequence_field(client: TestClient) -> None:
    response = client.get("/api/cards/comet-stellar-pup")
    assert response.status_code == 200
    body = response.json()
    fields_by_name = {field["name"]: field for field in body["fields"]}
    rolls = fields_by_name["rolls"]
    assert rolls["kind"] == "sequence"
    assert rolls["default"] == []
    # One option per die face, so the log shows what was rolled rather than which
    # branch it fell into.
    assert [option["value"] for option in rolls["options"]] == ["1", "2", "3", "4", "5", "6"]
    # The app rolls the die itself, so the UI shows one button instead of six.
    assert rolls["roll"] == {"faces": 6, "action_label": "Roll the die"}
    # That button switches off once he's out of activations for the turn.
    assert rolls["action_disabled_when"] == {"output": "activations_remaining", "less_than": 1}


def test_calculate_endpoint_walks_a_comet_roll_sequence_in_order(client: TestClient) -> None:
    response = client.post(
        "/api/cards/comet-stellar-pup/calculate",
        json={"inputs": {"starting_loyalty": 5, "rolls": ["1", "5"]}},
    )
    assert response.status_code == 200
    outputs = response.json()["outputs"]
    # +2 first, so the damage roll deals 7 rather than the 5 it would deal alone.
    assert outputs["damage_this_activation"] == 7
    assert outputs["loyalty"] == 5


def test_calculate_endpoint_rejects_a_roll_outside_the_declared_options(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/cards/comet-stellar-pup/calculate",
        json={"inputs": {"starting_loyalty": 5, "rolls": ["7"]}},
    )
    assert response.status_code == 422


def test_calculate_endpoint_applies_storm_copies_for_brain_freeze(client: TestClient) -> None:
    response = client.post(
        "/api/cards/brain-freeze/calculate",
        json={"inputs": {"storm_count": 4, "target_library_size": 99}},
    )
    assert response.status_code == 200
    assert response.json() == {
        "outputs": {
            "copies_from_storm": 4,
            "total_copies": 5,
            "cards_milled": 15,
            "library_after": 84,
            "mills_out": False,
        }
    }


def test_calculate_endpoint_grows_ob_nixilis_per_landfall_trigger(client: TestClient) -> None:
    response = client.post(
        "/api/cards/ob-nixilis-the-fallen/calculate",
        json={"inputs": {"existing_counters": 0, "triggers_per_land": 1, "lands_this_turn": 2}},
    )
    assert response.status_code == 200
    outputs = response.json()["outputs"]
    assert outputs["power"] == 9
    assert outputs["life_drained"] == 6


def test_get_craterhoof_behemoth_metadata_splits_setup_from_live(
    client: TestClient,
) -> None:
    response = client.get("/api/cards/craterhoof-behemoth")
    assert response.status_code == 200
    body = response.json()
    fields_by_name = {field["name"]: field for field in body["fields"]}
    assert fields_by_name["triggers"]["action_label"] == "Another trigger"
    # A trigger count of at least one: the card's own trigger is the first.
    assert fields_by_name["triggers"]["default"] == 1
    assert fields_by_name["triggers"]["min"] == 1
    # How many triggers you got is learned mid-turn, not one-time board setup -- both
    # it and the growth between triggers stay live rather than tucked into Setup.
    assert fields_by_name["triggers"]["setup"] is False
    assert fields_by_name["creatures_added_per_trigger"]["setup"] is False
    assert fields_by_name["total_power_before_triggers"]["setup"] is True
    assert fields_by_name["creature_count"]["setup"] is True

    outputs_by_name = {output["name"]: output for output in body["outputs"]}
    assert outputs_by_name["total_power_after_triggers"]["primary"] is True
    assert outputs_by_name["power_added"]["primary"] is False


def test_calculate_endpoint_applies_every_craterhoof_trigger(client: TestClient) -> None:
    response = client.post(
        "/api/cards/craterhoof-behemoth/calculate",
        json={
            "inputs": {
                "total_power_before_triggers": 8,
                "creature_count": 4,
                "triggers": 2,
                "creatures_added_per_trigger": 1,
            }
        },
    )
    assert response.status_code == 200
    # X of 4 then 5, since the body causing the second trigger counts itself.
    assert response.json() == {
        "outputs": {
            "total_power_after_triggers": 49,
            "power_added": 41,
            "pump_per_creature": 9,
            "last_trigger_bonus": 5,
        }
    }


def test_get_card_metadata_returns_full_schema(client: TestClient) -> None:
    response = client.get("/api/cards/aetherflux-reservoir")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Aetherflux Reservoir"
    field_names = {field["name"] for field in body["fields"]}
    assert field_names == {
        "starting_life",
        "was_in_play_at_turn_start",
        "spells_already_cast",
        "spells_cast_this_turn",
        "activations_used",
    }
    fields_by_name = {field["name"]: field for field in body["fields"]}
    assert fields_by_name["spells_cast_this_turn"]["default_source"] == "spells_already_cast"
    assert fields_by_name["activations_used"]["action_label"] == "Pay 50 Life"
    assert fields_by_name["activations_used"]["action_disabled_when"] == {
        "output": "current_life",
        "less_than": 50,
    }
    assert fields_by_name["starting_life"]["setup"] is True
    assert fields_by_name["spells_cast_this_turn"]["setup"] is False

    outputs_by_name = {output["name"]: output for output in body["outputs"]}
    assert outputs_by_name["damage_available"]["primary"] is True
    assert outputs_by_name["current_life"]["primary"] is False
    assert body["alert"] == {
        "output": "game_lost",
        "message": "Oops, looks like you lose now",
        "tone": "danger",
    }


def test_get_card_metadata_returns_404_for_unknown_card_id(client: TestClient) -> None:
    response = client.get("/api/cards/nonexistent-card")
    assert response.status_code == 404


def test_calculate_endpoint_returns_404_for_unknown_card_id(client: TestClient) -> None:
    response = client.post("/api/cards/nonexistent-card/calculate", json={"inputs": {}})
    assert response.status_code == 404


def test_calculate_endpoint_computes_life_for_reservoir_in_play_since_turn_start(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={"inputs": {"was_in_play_at_turn_start": True, "spells_cast_this_turn": 4}},
    )
    assert response.status_code == 200
    # starting_life is omitted, so it falls back to its declared default (40).
    assert response.json() == {
        "outputs": {
            "life_this_spell": 4,
            "total_life": 10,
            "current_life": 50,
            "damage_dealt": 0,
            "possible_activations": 1,
            "damage_available": 50,
            "spells_until_next_activation": 7,
            "game_lost": False,
        }
    }


def test_calculate_endpoint_applies_field_defaults_for_omitted_inputs(client: TestClient) -> None:
    # spells_already_cast and starting_life are both omitted, as the frontend would when
    # a field is hidden by visible_if or just left untouched — every omitted field must
    # fall back to its declared default instead of erroring.
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={"inputs": {"was_in_play_at_turn_start": True, "spells_cast_this_turn": 1}},
    )
    assert response.status_code == 200
    assert response.json() == {
        "outputs": {
            "life_this_spell": 1,
            "total_life": 1,
            "current_life": 41,
            "damage_dealt": 0,
            "possible_activations": 0,
            "damage_available": 0,
            "spells_until_next_activation": 3,
            "game_lost": False,
        }
    }


def test_calculate_endpoint_reports_activations_from_a_high_starting_life(
    client: TestClient,
) -> None:
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={"inputs": {"was_in_play_at_turn_start": True, "starting_life": 150}},
    )
    assert response.status_code == 200
    outputs = response.json()["outputs"]
    assert outputs["possible_activations"] == 3
    assert outputs["damage_available"] == 150


def test_calculate_endpoint_reflects_the_true_running_total_across_the_reservoir_entry(
    client: TestClient,
) -> None:
    # The regression case from the field rename: 2 spells cast before the Reservoir
    # entered, 1 more since -- the field holds the true total (3), and that 3rd spell
    # correctly gains 3 life.
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={
            "inputs": {
                "was_in_play_at_turn_start": False,
                "spells_already_cast": 2,
                "spells_cast_this_turn": 3,
            }
        },
    )
    assert response.status_code == 200
    outputs = response.json()["outputs"]
    assert outputs["life_this_spell"] == 3
    assert outputs["total_life"] == 3


def test_calculate_endpoint_deducts_life_per_activation_used(client: TestClient) -> None:
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={
            "inputs": {
                "was_in_play_at_turn_start": True,
                "starting_life": 120,
                "activations_used": 1,
            }
        },
    )
    assert response.status_code == 200
    outputs = response.json()["outputs"]
    assert outputs["current_life"] == 70
    assert outputs["damage_dealt"] == 50
    assert outputs["possible_activations"] == 1


def test_calculate_endpoint_rejects_value_above_field_max(client: TestClient) -> None:
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={"inputs": {"was_in_play_at_turn_start": True, "spells_cast_this_turn": 100}},
    )
    assert response.status_code == 422


def test_calculate_endpoint_rejects_wrong_type_for_boolean_field(client: TestClient) -> None:
    response = client.post(
        "/api/cards/aetherflux-reservoir/calculate",
        json={"inputs": {"was_in_play_at_turn_start": "yes", "spells_cast_this_turn": 1}},
    )
    assert response.status_code == 422
