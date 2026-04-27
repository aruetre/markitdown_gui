from fastapi.testclient import TestClient

from backend.main import SUPPORTED_EXTENSIONS, app

client = TestClient(app)


def test_root_serves_index_html():
    r = client.get("/")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]
    assert "<html" in r.text.lower()


def test_static_assets_mounted():
    css = client.get("/static/styles.css")
    js = client.get("/static/script.js")
    assert css.status_code == 200
    assert js.status_code == 200


def test_supported_formats_endpoint():
    r = client.get("/api/supported-formats")
    assert r.status_code == 200
    body = r.json()
    assert body["formats"] == SUPPORTED_EXTENSIONS
    assert set(body["extensions"]) == set(SUPPORTED_EXTENSIONS.keys())


def test_convert_single_rejects_unsupported_extension():
    r = client.post(
        "/api/convert-single",
        files={"file": ("evil.exe", b"MZ\x90\x00", "application/octet-stream")},
    )
    assert r.status_code == 400
    assert "not supported" in r.json()["detail"].lower()


def test_convert_single_converts_text_file():
    r = client.post(
        "/api/convert-single",
        files={"file": ("hello.txt", b"hola mundo", "text/plain")},
    )
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "success"
    assert body["original_filename"] == "hello.txt"
    assert body["markdown_filename"] == "hello.md"
    assert body["extension"] == ".txt"
    assert "hola mundo" in body["markdown_content"]


def test_convert_multi_collects_errors_alongside_results():
    r = client.post(
        "/api/convert",
        files=[
            ("files", ("a.txt", b"alpha", "text/plain")),
            ("files", ("b.exe", b"\x00\x00", "application/octet-stream")),
        ],
    )
    assert r.status_code == 200
    body = r.json()
    assert body["total_files"] == 2
    assert body["successful"] == 1
    assert body["failed"] == 1
    assert body["results"][0]["original_filename"] == "a.txt"
    assert body["errors"][0]["filename"] == "b.exe"


def test_convert_multi_requires_at_least_one_file():
    r = client.post("/api/convert", files=[])
    assert r.status_code == 422
