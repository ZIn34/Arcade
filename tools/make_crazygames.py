"""Makes the CrazyGames copy of the arcade: dist/crazygames/ and dist/crazygames.zip (upload the zip).

It is the same arcade with the CrazyGames SDK added at the top of index.html. The offline service worker
and home-screen manifest are left out (CrazyGames hosts the game itself). Usage: python tools/make_crazygames.py
"""
import pathlib
import shutil
import zipfile

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "dist" / "crazygames"
ZIP = ROOT / "dist" / "crazygames.zip"
SDK = '<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>'
KEEP = ["index.html", "css", "js", "assets", "icons"]

if OUT.exists():
    shutil.rmtree(OUT)
OUT.mkdir(parents=True)
for name in KEEP:
    src = ROOT / name
    if src.is_dir():
        shutil.copytree(src, OUT / name)
    else:
        shutil.copy2(src, OUT / name)

page = (OUT / "index.html").read_text(encoding="utf-8")
page = page.replace('<link rel="manifest" href="manifest.webmanifest">\n', "")
assert "</head>" in page
page = page.replace('<link rel="stylesheet"', SDK + '\n<link rel="stylesheet"', 1)
(OUT / "index.html").write_text(page, encoding="utf-8", newline="\n")

ZIP.unlink(missing_ok=True)
with zipfile.ZipFile(ZIP, "w", zipfile.ZIP_DEFLATED) as z:
    for f in sorted(OUT.rglob("*")):
        if f.is_file():
            z.write(f, f.relative_to(OUT).as_posix())
files = sum(1 for f in OUT.rglob("*") if f.is_file())
size = ZIP.stat().st_size / 1e6
print(f"made {ZIP} ({files} files, {size:.1f} MB)")
