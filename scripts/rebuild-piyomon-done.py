"""
Rebuild piyomon_done.png
Edit the SHIFT values below to adjust vertical position of each frame.

Save only:     python3 scripts/rebuild-piyomon-done.py
Preview only:  python3 scripts/rebuild-piyomon-done.py --preview
"""
import sys
from PIL import Image

src = Image.open("public/universal_assets/citizens/Piyomon Vital Bracelet BE.png").convert('RGBA')

cols = [1, 66, 131, 196]
rows = [1, 66, 131]

# ===== EDIT THESE VALUES =====
FRAME1_SHIFT = 9    # Row1 Frame1: positive = move down, negative = move up
FRAME2_SHIFT = 25    # Row3 Frame1: positive = move down, negative = move up
# ==============================

def extract_cell(col_idx, row_idx):
    cx, cy = cols[col_idx], rows[row_idx]
    cell = src.crop((cx, cy, cx + 64, cy + 64)).convert('RGBA')
    pixels = cell.load()
    for py in range(64):
        for px in range(64):
            r, g, b, a = pixels[px, py]
            if (r == 0 and g == 255 and b == 0) or (r > 200 and g < 50 and b > 150) or (r > 200 and g < 20 and b > 200):
                pixels[px, py] = (0, 0, 0, 0)
    return cell

def shift_frame(img, shift_y):
    result = Image.new('RGBA', (64, 64), (0, 0, 0, 0))
    bbox = img.getbbox()
    if not bbox:
        return result
    content = img.crop(bbox)
    new_y = bbox[1] + shift_y
    result.paste(content, (bbox[0], new_y), content)
    return result

f1 = shift_frame(extract_cell(0, 0), FRAME1_SHIFT)
f2 = shift_frame(extract_cell(0, 2), FRAME2_SHIFT)

for name, f in [("Frame1", f1), ("Frame2", f2)]:
    min_y, max_y = 64, 0
    for y in range(64):
        for x in range(64):
            if f.getpixel((x, y))[3] > 10:
                min_y = min(min_y, y)
                max_y = max(max_y, y)
    print(f"{name}: top={min_y} bottom={max_y}")

# Build preview: both frames on dark bg with ground line, scaled 5x
preview = Image.new('RGBA', (148, 80), (13, 17, 23, 255))
preview.paste(f1, (5, 8), f1)
preview.paste(f2, (79, 8), f2)
for x in range(148):
    preview.putpixel((x, 72), (29, 158, 117, 150))
preview_big = preview.resize((740, 400), Image.NEAREST)

if '--preview' in sys.argv:
    preview_big.show()
    print("Preview shown. Edit SHIFT values, save, run again.")
else:
    done = Image.new('RGBA', (640, 64), (0, 0, 0, 0))
    for i in range(10):
        frame = f1 if i % 2 == 0 else f2
        done.paste(frame, (i * 64, 0), frame)
    done.save("public/universal_assets/citizens/piyomon_done.png")
    preview_big.show()
    print("Saved piyomon_done.png!")
