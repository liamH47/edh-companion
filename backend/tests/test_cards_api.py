from fastapi.testclient import TestClient


def test_get_cards_includes_aetherflux_reservoir(client: TestClient) -> None:
    response = client.get("/api/cards")
    assert response.status_code == 200
    card_ids = {card["id"] for card in response.json()}
    assert "aetherflux-reservoir" in card_ids


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
