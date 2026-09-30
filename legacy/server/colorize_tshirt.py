from PIL import Image
import os

input_dir = "../client/src/assets/Product_img/"
output_dir = "../client/src/assets/Product_img/colored/"
os.makedirs(output_dir, exist_ok=True)

colors = {
    "white": (255, 255, 255),
    "black": (30, 30, 30),
    "grey": (140, 140, 140),
    "red": (180, 30, 30),
    "blue": (30, 80, 180),
    "green": (30, 130, 60),
    "navy": (26, 39, 68),
}

images = [
    "basic_tshirt_front.png",
    "basic_tshirt_back.png",
    "hoodie_front.png",
    "hoodie_back.png",
    "bag_front.png",
    "bag_back.png",
]

for img_name in images:
    img = Image.open(input_dir + img_name).convert("RGBA")
    r, g, b, a = img.split()

    for color_name, (cr, cg, cb) in colors.items():
        colored = Image.new("RGBA", img.size, (0, 0, 0, 0))
        for x in range(img.width):
            for y in range(img.height):
                pr, pg, pb, pa = img.getpixel((x, y))
                if pa > 10:
                    brightness = (pr + pg + pb) / (3 * 255)
                    nr = int(cr * brightness)
                    ng = int(cg * brightness)
                    nb = int(cb * brightness)
                    colored.putpixel((x, y), (nr, ng, nb, pa))

        base = img_name.replace(".png", "")
        out_path = f"{output_dir}{base}_{color_name}.png"
        colored.save(out_path)
        print(f"Saved: {out_path}")

print("Done!")
