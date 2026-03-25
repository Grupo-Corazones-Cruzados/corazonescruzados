"""
Rebuild piyomon working row (row 0 of actions sheet).
Uses Row 3 Frame 2 from Piyomon Vital Bracelet BE.png

Save only:     python3 scripts/rebuild-piyomon-working.py
Preview only:  python3 scripts/rebuild-piyomon-working.py --preview
"""
import sys
from PIL import Image

src = Image.open("public/universal_assets/citizens/Piyomon Vital Bracelet BE.png").convert('RGBA')

cols = [1, 66, 131, 196]
rows = [1, 66, 131]

# ===== EDIT THIS VALUE =====
SHIFT = 25    # positive = move down, negative = move up
# ============================

def extract_cell(col_idx, row_idx):
    cx, cy = cols[col_idx], rows[row_idx]
    cell = src.crop((cx, cy, cx + 64, cy + 64)).convert('RGBA')
    pixels = cell.load()
    for py in range(64):
        for px in range(64):
            r, g, b, a = pixels[px, py]
            if (r == 0 and g == 255 and b == 0) or (r > 200 and g < 50 and b > 150) or (r > 200 and g < 20 and b > 200):
                pixels[px, py] = (0, 0, 0, 0)
    # Clear top 15 rows to remove any text/copyright
    for py in range(0):
        for px in range(64):
            pixels[px, py] = (0, 0, 0, 0)
    return cell

# Row 3 (index 2), Frame 2 (index 1)
frame = extract_cell(1, 2)

# Apply shift
shifted = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
bbox = frame.getbbox()
if bbox:
    content = frame.crop(bbox)
    shifted.paste(content, (bbox[0], bbox[1] + SHIFT), content)
    shifted = shifted.crop((0, 0, 64, 64))

min_y, max_y = 64, 0
for y in range(64):
    for x in range(64):
        if shifted.getpixel((x, y))[3] > 10:
            min_y = min(min_y, y)
            max_y = max(max_y, y)
print(f"Working frame: top={min_y} bottom={max_y}")

# Build preview: frame on dark bg with ground line, scaled 5x
preview = Image.new('RGBA', (80, 80), (13, 17, 23, 255))
preview.paste(shifted, (8, 8), shifted)
for x in range(80):
    preview.putpixel((x, 72), (29, 158, 117, 150))
preview_big = preview.resize((400, 400), Image.NEAREST)

if '--preview' in sys.argv:
    preview_big.show()
    print("Preview shown. Edit SHIFT value, save, run again.")
else:
    actions = Image.open("public/universal_assets/citizens/piyomon_actions.png").convert('RGBA')
    actions.paste(Image.new('RGBA', (256, 64), (0, 0, 0, 0)), (0, 0))
    for i in range(4):
        actions.paste(shifted, (i * 64, 0), shifted)
    actions.save("public/universal_assets/citizens/piyomon_actions.png")
    preview_big.show()
    print("Saved piyomon_actions.png!")
