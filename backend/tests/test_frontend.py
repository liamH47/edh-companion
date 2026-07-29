from pathlib import Path

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.frontend import mount_frontend


def test_mount_frontend_registers_nothing_when_dist_dir_is_missing(tmp_path: Path) -> None:
    app = FastAPI()
    mount_frontend(app, tmp_path / "does-not-exist")

    client = TestClient(app)
    assert client.get("/").status_code == 404


def test_mount_frontend_serves_index_html_at_root(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>root</html>")
    app = FastAPI()
    mount_frontend(app, tmp_path)

    response = TestClient(app).get("/")
    assert response.status_code == 200
    assert "root" in response.text


def test_mount_frontend_serves_bundled_assets_from_the_assets_mount(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>root</html>")
    assets_dir = tmp_path / "assets"
    assets_dir.mkdir()
    (assets_dir / "app.js").write_text("console.log('hi')")
    app = FastAPI()
    mount_frontend(app, tmp_path)

    response = TestClient(app).get("/assets/app.js")
    assert response.status_code == 200
    assert "console.log" in response.text


def test_mount_frontend_falls_back_to_index_html_for_unknown_spa_routes(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>root</html>")
    app = FastAPI()
    mount_frontend(app, tmp_path)

    response = TestClient(app).get("/some/client/side/route")
    assert response.status_code == 200
    assert "root" in response.text


def test_mount_frontend_serves_a_real_file_outside_the_assets_mount(tmp_path: Path) -> None:
    (tmp_path / "index.html").write_text("<html>root</html>")
    (tmp_path / "favicon.svg").write_text("<svg></svg>")
    app = FastAPI()
    mount_frontend(app, tmp_path)

    response = TestClient(app).get("/favicon.svg")
    assert response.status_code == 200
    assert "svg" in response.text
