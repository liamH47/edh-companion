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


def test_mount_frontend_does_not_serve_files_via_dotdot_traversal(tmp_path: Path) -> None:
    # A secret sits one directory above the served dist root. `..` segments in the URL
    # must not climb out to it -- they fall through to the SPA shell instead.
    dist = tmp_path / "static"
    dist.mkdir()
    (dist / "index.html").write_text("<html>root</html>")
    (tmp_path / "secret.txt").write_text("TOP SECRET")
    app = FastAPI()
    mount_frontend(app, dist)

    client = TestClient(app)
    for path in ("/../secret.txt", "/..%2fsecret.txt", "/subdir/../../secret.txt"):
        response = client.get(path)
        assert "TOP SECRET" not in response.text
        assert "root" in response.text


def test_mount_frontend_does_not_serve_files_via_absolute_path(tmp_path: Path) -> None:
    # `dist / "/abs/path"` collapses to "/abs/path" under pathlib -- the guard must reject
    # an absolute candidate rather than reading it off the real filesystem.
    dist = tmp_path / "static"
    dist.mkdir()
    (dist / "index.html").write_text("<html>root</html>")
    secret = tmp_path / "secret.txt"
    secret.write_text("TOP SECRET")
    app = FastAPI()
    mount_frontend(app, dist)

    # A leading double slash makes Starlette's `full_path` an absolute path.
    response = TestClient(app).get(f"/{secret}")
    assert "TOP SECRET" not in response.text
    assert response.status_code == 200
    assert "root" in response.text
