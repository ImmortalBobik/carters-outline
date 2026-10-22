"""
Utility script to re-download official CarterPCs portrait and branding assets.
"""
import os
import urllib.request
from PIL import Image

ASSETS = {
    "01_carter_outdoor_headshot.jpg": "https://yt3.googleusercontent.com/nek-YJ8BswOLuUIFHXOY47jNWNxaC7_B_jgbCLh6boXR8jvI0pKqS0B_hnafvnSf77XU2UABFA=s900-c-k-c0x00ffffff-no-rj",
    "02_carter_mashable_editorial.jpg": "https://helios-i.mashable.com/imagery/articles/07FsuRkNlUlT7K710RtCf8Y/hero-image.jpg",
    "03_carter_studio_tech_pointing.jpg": "https://i.ytimg.com/vi/-afHQF-rG9I/maxresdefault.jpg",
    "04_carter_tech_reaction_smile.jpg": "https://i.ytimg.com/vi/HE9KD9tt-cE/maxresdefault.jpg",
    "05_carter_casual_room_portrait.jpg": "https://i.ytimg.com/vi/39q-ck7TQVM/maxresdefault.jpg",
    "06_carter_cartoon_mascot.jpg": "https://linktr.ee/og/image/CarterPCS.jpg",
}

def main():
    target_dir = os.path.join(os.path.dirname(__file__), "..", "assets", "carter_portraits")
    os.makedirs(target_dir, exist_ok=True)
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}

    for filename, url in ASSETS.items():
        out_path = os.path.join(target_dir, filename)
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req) as resp:
            data = resp.read()
            with open(out_path, "wb") as f:
                f.write(data)
        im = Image.open(out_path)
        print(f"Downloaded {filename}: {im.size[0]}x{im.size[1]} ({len(data)} bytes)")

if __name__ == "__main__":
    main()
