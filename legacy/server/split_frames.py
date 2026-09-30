from PIL import Image
import os

img = Image.open("../client/src/assets/tshirts/frames_blue/spritesheet.png")
w, h = img.size
cols, rows = 6, 4
fw, fh = w // cols, h // rows

out = "../client/src/assets/tshirts/frames_blue/"
for i in range(rows):
    for j in range(cols):
        n = i * cols + j
        frame = img.crop((j*fw, i*fh, (j+1)*fw, (i+1)*fh))
        frame.save(f"{out}frame_{n:02d}.png")
        print(f"Saved frame_{n:02d}.png")

print("Done! 24 frames saved.")
