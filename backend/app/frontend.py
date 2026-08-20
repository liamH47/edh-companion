"""Serves the built frontend SPA, if present.

Absent during local dev (the Vite dev server handles the frontend instead, proxying
/api to this backend); present in the production container once `vite build`'s
output has been copied in alongside this package.
"""

from pathlib import Path

from fastapi import FastAPI
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_frontend(app: FastAPI, dist_dir: Path) -> None:
    if not dist_dir.is_dir():
        return

    assets_dir = dist_dir / "assets"
    if assets_dir.is_dir():
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend-assets")

    root = dist_dir.resolve()

    @app.get("/{full_path:path}")
    def serve_frontend(full_path: str) -> FileResponse:
        # `dist_dir / full_path` is NOT safe on its own: pathlib's `/` discards the left
        # operand when the right side is absolute (`dist_dir / "/etc/passwd"` == "/etc/passwd"),
        # and `..` segments climb out of the root -- so an unchecked catch-all is an
        # arbitrary-file-read. Resolve the candidate and require it to stay inside the
        # dist root before serving anything; everything else falls through to the SPA
        # shell, exactly as a genuine client-side route already does.
        candidate = (dist_dir / full_path).resolve()
        if full_path and (candidate == root or root in candidate.parents) and candidate.is_file():
            return FileResponse(candidate)
        return FileResponse(root / "index.html")
