# -*- coding: utf-8 -*-
"""Rebuild NEXORA catalog with guaranteed images + large stock per category."""
import json
import random
import re
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PRODUCTS_PATH = ROOT / "data" / "products.json"
CATEGORIES_PATH = ROOT / "data" / "categories.json"
random.seed(77)

# Proven Unsplash photo IDs (used successfully in this project)
PHOTO_IDS = [
    "1511707171634-5f897ff02aa9", "1517336714731-489689fd1ca8", "1505740420928-5e560c06d30e",
    "1523275335684-37898b6baf30", "1542291026-7eec264c27ff", "1484154218962-a197022b5858",
    "1517836357463-d25dfeac3438", "1503454537195-1dcabb73ffb9", "1596462502278-27bfdc403348",
    "1492144534655-ae79c964c9d7", "1495446815904-a765d234fa3c", "1498049794561-7780e7231661",
    "1593642632823-8f785ba67e45", "1542751371-adc38448a05e", "1516035069371-29a1b244cc32",
    "1556911220-bff31c812dba", "1523381210434-271e8be1f52b", "1571019614242-c5c5dee9f50b",
    "1515488042361-ee00e0ddd4e4", "1522335789203-aabd1fc54bc9", "1486262715619-67bcb6d2f9d3",
    "1512820790803-83ca734da794", "1546868871-7041f2a55e12", "1606144042614-b2417e99c4e3",
    "1555041469-a586c61ea9bc", "1445205170230-053b83016050", "1461896836934-ffe607ba6852",
    "1566576912321-d58ddd7a6088", "1571781926291-c477ebfd024b", "1503376780353-7e6692767b70",
    "1544947950-fa07a98d237f", "1496181133206-80ce9b88a853", "1484704849709-1afcb7889d9a",
    "1525547719571-a2d4ac8945e2", "1553062407-98eeb64c6a62", "1586023492125-27b2c045efd7",
    "1592899677977-9c10ca588bbd", "1610945415295-d9bbf067e59c", "1601784551446-20c9e07cdbdb",
    "1565849904461-04a58ad377e0", "1556656793-08538906a9f8", "1580910051074-3eb694886505",
    "1498050108023-c5249f4df085", "1588872657578-7efd1f1555cd", "1527443224154-c4a3942d3daf",
    "1484788984921-03950022c9ef", "1546435776-0f2fdb84b5a8", "1572536147248-ac59a8abfa64",
    "1487215078519-e21cc028cb29", "1545127398-14699f92334b", "1593784991095-a205069470b6",
    "1571415060716-baff5f717c37", "1538481199705-c710c4e965fc", "1552820728-8b83bb6b773f",
    "1493711662062-fa541f7f7a0a", "1593305841991-05c297ba4575", "1502920917128-1aa500764cbd",
    "1526170375885-4d8ecf77b99f", "1500634245200-ba16d476c3f0", "1579586337278-3befd40fd17a",
    "1483985988355-763728e1935b", "1434389677669-e08b4cac3105", "1515886657613-9f3515b0c78f",
    "1490481651871-ab68de25d43d", "1549062572-544a64fb0c56", "1493663284031-b7e3aefcae8e",
    "1560184897-ae75f418493e", "1534438327276-14e5300c3a48", "1571902943202-371fec6db38e",
    "1541534741688-6078c6bfb5c5", "1596461404969-9ae70f2830c1", "1512496015851-a90fb38ba796",
    "1522337660859-ce7abd77c4ec", "1616394584738-fc2957268627", "1598440947619-7a9212743550",
    "1549317661-bd32c8ce0db2", "1494976388531-d1058494cdd8", "1519682337058-a94d519337bc",
    "1532012197267-dafd08ada2d0", "1616046229478-9901c5536a45", "1456513080080-f7c7f9e2a3e1",
]

# Pull any extra photo IDs already in current products.json
if PRODUCTS_PATH.exists():
    raw = PRODUCTS_PATH.read_text(encoding="utf-8")
    for m in re.findall(r"photo-([0-9]+-[a-zA-Z0-9]+)", raw):
        if m not in PHOTO_IDS:
            PHOTO_IDS.append(m)

POOL = {
    "phones": PHOTO_IDS[0:12],
    "laptops": PHOTO_IDS[12:24],
    "audio": PHOTO_IDS[24:32],
    "tv": PHOTO_IDS[32:40],
    "gaming": PHOTO_IDS[8:18],
    "cameras": PHOTO_IDS[18:28],
    "wearables": PHOTO_IDS[4:14],
    "fashion": PHOTO_IDS[20:40],
    "home": PHOTO_IDS[30:50],
    "sports": PHOTO_IDS[10:30],
    "kids": PHOTO_IDS[15:35],
    "beauty": PHOTO_IDS[25:45],
    "auto": PHOTO_IDS[5:25],
    "books": PHOTO_IDS[35:55] if len(PHOTO_IDS) > 55 else PHOTO_IDS[5:25],
}

GRAD = {
    "electronics": "linear-gradient(135deg,#111,#333)",
    "fashion": "linear-gradient(135deg,#330000,#FF0000)",
    "home": "linear-gradient(135deg,#1a472a,#2e7d32)",
    "sports": "linear-gradient(135deg,#0d47a1,#1565c0)",
    "kids": "linear-gradient(135deg,#e65100,#ff9800)",
    "beauty": "linear-gradient(135deg,#4a148c,#7b1fa2)",
    "auto": "linear-gradient(135deg,#212121,#424242)",
    "books": "linear-gradient(135deg,#3e2723,#5d4037)",
}


def u(pid):
    return f"https://images.unsplash.com/photo-{pid}?auto=format&fit=crop&w=1200&h=1200&q=80"


def imgs(pool_key, i):
    pool = POOL.get(pool_key) or PHOTO_IDS
    a = pool[i % len(pool)]
    b = pool[(i + 3) % len(pool)]
    c = PHOTO_IDS[(i + 7) % len(PHOTO_IDS)]
    return u(a), u(b), u(c)


CATALOG = [
    # electronics — phones & computers heavy
    ("electronics", "smartphones", "phones",
     [("Samsung", "samsung"), ("Apple", "apple"), ("Xiaomi", "xiaomi"), ("Sony", "sony"), ("Huawei", "huawei"), ("Google", "google")],
     [
         "Galaxy S24 Ultra", "Galaxy S24", "Galaxy A55", "Galaxy A35", "Galaxy Z Flip",
         "iPhone 15 Pro Max", "iPhone 15 Pro", "iPhone 15", "iPhone 14", "iPhone SE style",
         "Redmi Note 13 Pro", "POCO X6", "Xiaomi 14", "Nova 12 Pro", "Xperia 1 VI",
         "Pixel 8 Pro", "Pixel 8", "Camera King Phone", "Battery Max Phone", "Gaming Phone Turbo",
         "Business Phone Elite", "Compact Flagship", "AI Phone Studio", "Note Stylus Phone",
         "Foldable Slim", "Youth 5G Phone", "Ultra Cam Phone", "Dual SIM Pro", "Lite Edition Phone",
         "Power Phone 6000", "Slim Metal Phone", "Creator Phone 5G", "Rugged Phone X",
     ]),
    ("electronics", "laptops", "laptops",
     [("Apple", "apple"), ("Asus", "asus"), ("Lenovo", "lenovo"), ("HP", "hp"), ("Dell", "dell"), ("Samsung", "samsung"), ("MSI", "msi")],
     [
         "MacBook Pro 14", "MacBook Air 13", "MacBook Pro 16", "ZenBook OLED", "VivoBook 15",
         "ThinkPad X1", "IdeaPad Slim", "Legion Gaming", "Pavilion Plus", "Envy x360",
         "XPS 13", "Inspiron 15", "Galaxy Book4", "Stealth Gaming Laptop", "Creator Laptop 16",
         "Student Notebook", "Business Ultrabook", "2-in-1 Convertible", "Workstation Pro",
         "Travel Laptop 1kg", "Esports 165Hz Laptop", "Silent Office Laptop", "Touch Laptop 15",
         "AMD Advantage Laptop", "Evo Certified Laptop", "Budget Laptop 8GB", "Max RAM 32GB Laptop",
         "Color Accurate Laptop", "All-day Battery Laptop", "OLED Creator Laptop",
     ]),
    ("electronics", "audio", "audio",
     [("Sony", "sony"), ("JBL", "jbl"), ("Apple", "apple"), ("Samsung", "samsung"), ("Xiaomi", "xiaomi")],
     [
         "WH-1000XM Headphones", "WF Earbuds Pro", "Flip Speaker", "Charge Boombox",
         "AirPods-style Pro", "Galaxy Buds", "Neckband Sport", "Soundbar 2.1",
         "Studio Monitor HP", "Kids Safe Headphones", "Open-ear Buds", "Partybox Mini",
     ]),
    ("electronics", "tv", "tv",
     [("Samsung", "samsung"), ("LG", "lg"), ("Sony", "sony"), ("Xiaomi", "xiaomi")],
     [
         "4K Smart TV 43", "4K Smart TV 55", "OLED TV 65", "QLED TV 50", "Gaming Monitor 27",
         "Ultrawide 34 Monitor", "Office Monitor 24", "Portable Monitor 15", "Mini LED TV 48",
     ]),
    ("electronics", "gaming", "gaming",
     [("Logitech", "logitech"), ("Asus", "asus"), ("Sony", "sony"), ("Razer", "razer")],
     [
         "Wireless Controller", "Mechanical Keyboard RGB", "Gaming Mouse Ultra", "VR Headset Lite",
         "Capture Card 4K", "Racing Wheel", "Gaming Headset", "Stream Mic Kit",
     ]),
    ("electronics", "cameras", "cameras",
     [("Sony", "sony"), ("Canon", "canon"), ("GoPro", "gopro"), ("DJI", "dji")],
     [
         "Mirrorless Kit", "Action Cam 4K", "Vlog Compact", "Drone Mini", "Lens 50mm", "Gimbal Phone",
     ]),
    ("electronics", "wearables", "wearables",
     [("Apple", "apple"), ("Samsung", "samsung"), ("Xiaomi", "xiaomi"), ("Garmin", "garmin")],
     [
         "Watch Ultra", "Watch Series", "Galaxy Watch", "Fitness Band", "Kids Watch GPS", "Sport GPS Watch",
     ]),
    ("fashion", "shoes", "fashion",
     [("Nike", "nike"), ("Adidas", "adidas"), ("Puma", "puma"), ("New Balance", "newbalance")],
     [
         "Air Runner", "Ultraboost Style", "Classic Leather", "Trail Boot", "City Loafer",
         "High-top Sneaker", "Chelsea Boot", "Summer Sandal", "Retro Trainer", "Walking Comfort",
     ]),
    ("fashion", "apparel", "fashion",
     [("Zara", "zara"), ("H&M", "hm"), ("Levi's", "levis"), ("Nike", "nike"), ("Adidas", "adidas")],
     [
         "Oversized Hoodie", "Slim Jeans", "Linen Shirt", "Wool Coat", "Denim Jacket",
         "Cotton Tee Pack", "Chino Pants", "Quilted Vest", "Knit Sweater", "Rain Jacket",
         "Polo Shirt", "Cargo Pants", "Track Pants", "Blazer Smart",
     ]),
    ("fashion", "accessories", "fashion",
     [("Casio", "casio"), ("Nike", "nike"), ("Zara", "zara")],
     [
         "Leather Belt", "Crossbody Bag", "Aviator Sunglasses", "Travel Backpack",
         "Silk Scarf", "Minimal Cap", "Canvas Tote", "Watch Strap",
     ]),
    ("home", "appliances", "home",
     [("Philips", "philips"), ("Bosch", "bosch"), ("Dyson", "dyson"), ("Tefal", "tefal"), ("Samsung", "samsung")],
     [
         "Robot Vacuum", "Air Purifier", "Espresso Machine", "Blender Pro", "Electric Kettle",
         "Steam Iron", "Air Fryer XL", "Microwave Grill", "Dishwasher Compact", "Washer 8kg",
     ]),
    ("home", "smart-home", "home",
     [("Xiaomi", "xiaomi"), ("Philips", "philips"), ("Samsung", "samsung")],
     ["Smart Thermostat", "Smart Bulb Kit", "Smart Plug", "Door Camera", "Robot Mop", "Smart Lock"]),
    ("home", "decor", "home",
     [("IKEA", "ikea"), ("NEXORA Home", "nexorahome")],
     [
         "LED Floor Lamp", "Throw Blanket", "Ceramic Vase", "Wall Clock", "Scent Diffuser",
         "Candle Set", "Desk Organizer", "Storage Basket", "Photo Frame Set", "Rug Soft",
     ]),
    ("sports", "shoes", "sports",
     [("Nike", "nike"), ("Adidas", "adidas"), ("Puma", "puma"), ("Reebok", "reebok")],
     [
         "Running Shoes Light", "Trail Run Shoe", "Training Shoe", "Basketball Shoe",
         "Football Boot", "Walking Shoe", "Indoor Court Shoe", "Marathon Racer",
     ]),
    ("sports", "equipment", "sports",
     [("Decathlon", "decathlon"), ("Nike", "nike"), ("Adidas", "adidas")],
     [
         "Yoga Mat Premium", "Dumbbell Set", "Resistance Bands", "Jump Rope", "Foam Roller",
         "Boxing Gloves", "Tennis Racket", "Football Size 5", "Cycling Helmet", "Hiking Pack 30L",
         "Water Bottle", "Gym Duffel",
     ]),
    ("sports", "apparel", "sports",
     [("Nike", "nike"), ("Adidas", "adidas"), ("Under Armour", "underarmour")],
     ["Compression Tights", "Training Tee", "Sport Jacket", "Gym Shorts", "Yoga Leggings", "Run Cap"]),
    ("kids", "toys", "kids",
     [("Lego", "lego"), ("Mattel", "mattel"), ("Hasbro", "hasbro"), ("NEXORA Kids", "nexorakids")],
     [
         "Building Blocks 500", "RC Car Turbo", "Plush Bear", "STEM Robot", "Puzzle Map",
         "Play Kitchen", "Wooden Train", "Bubble Machine", "Board Game", "Art Set 64",
         "Kids Scooter", "Night Light", "Doll House Mini", "Magic Kit",
     ]),
    ("kids", "apparel", "kids",
     [("NEXORA Kids", "nexorakids"), ("Nike", "nike")],
     ["Kids Sneakers", "Rain Jacket Kids", "School Backpack", "Kids Cap", "Kids Hoodie"]),
    ("beauty", "skincare", "beauty",
     [("L'Oréal", "loreal"), ("Nivea", "nivea"), ("The Ordinary", "theordinary"), ("NEXORA Beauty", "nexorabeauty")],
     [
         "Vitamin C Serum", "Hydra Cream", "SPF 50", "Cleansing Foam", "Eye Cream",
         "Face Mask Pack", "Toner", "Night Cream", "Lip Balm Set", "Body Lotion",
     ]),
    ("beauty", "makeup", "beauty",
     [("Maybelline", "maybelline"), ("L'Oréal", "loreal")],
     ["Lip Tint", "Mascara Volume", "BB Cream", "Nail Set", "Brush Kit", "Foundation Matte"]),
    ("auto", "electronics", "auto",
     [("Baseus", "baseus"), ("Philips", "philips"), ("Bosch", "bosch"), ("NEXORA Auto", "nexoraauto")],
     [
         "Dash Cam HD", "Jump Starter", "Car Charger Wireless", "OBD2 Scanner",
         "Parking Sensors", "LED Headlight", "Tire Inflator", "Car Vacuum",
     ]),
    ("auto", "accessories", "auto",
     [("NEXORA Auto", "nexoraauto"), ("Michelin", "michelin")],
     [
         "Phone Mount", "Seat Covers", "Trunk Organizer", "Floor Mats", "Steering Cover",
         "Sunshade", "Cup Holder", "Emergency Kit",
     ]),
    ("books", "fiction", "books",
     [("Penguin", "penguin"), ("Local Press", "localpress"), ("NEXORA Books", "nexorabooks")],
     [
         "Sci-Fi Anthology", "Modern Novel", "Mystery Thriller", "Poetry Book",
         "Short Stories", "Classic Reprint", "Drama Collection", "Adventure Tale",
     ]),
    ("books", "hobby", "books",
     [("Art House", "arthouse"), ("NEXORA Books", "nexorabooks")],
     [
         "Photography Master", "Cooking Classics", "Guitar Beginner", "DIY Home",
         "Sketchbook Pro", "Travel Notebook", "Planner 2026", "Coloring Book",
     ]),
]


def price_for(cat, sub):
    if sub == "smartphones":
        return random.choice([349, 449, 549, 699, 899, 1199, 1499, 1899, 2199, 2599])
    if sub == "laptops":
        return random.choice([999, 1299, 1599, 1899, 2299, 2799, 3299, 3799, 4299])
    if cat == "electronics":
        return random.choice([49, 79, 99, 149, 199, 299, 399, 599, 799])
    return random.choice([19, 29, 39, 49, 69, 89, 119, 149, 199, 249, 299])


def make(idx, cat, sub, pool, name, brand, brand_id):
    i1, i2, i3 = imgs(pool, idx)
    price = price_for(cat, sub)
    old = price + random.choice([30, 50, 80, 120, 200]) if random.random() < 0.42 else None
    is_new = random.random() < 0.34
    badge = "Yeni" if is_new else (f"-{int((old-price)/old*100)}%" if old else ("Hit" if random.random() < 0.1 else None))
    badge_type = "primary" if badge == "Yeni" else ("sale" if old and badge and badge.startswith("-") else "dark")
    g = GRAD[cat]
    full = f"{brand} {name}"
    return {
        "id": f"p{idx:04d}",
        "sku": f"{brand_id[:3].upper()}-{sub[:3].upper()}-{idx:04d}",
        "name": full,
        "brand": brand,
        "brandId": brand_id,
        "category": cat,
        "subcategory": sub,
        "price": price,
        "oldPrice": old,
        "currency": "₼",
        "rating": round(random.uniform(4.0, 5.0), 1),
        "reviews": random.randint(8, 420),
        "badge": badge,
        "badgeType": badge_type,
        "inStock": True,
        "stock": random.randint(5, 160),
        "isNew": is_new,
        "tags": [cat, sub, brand_id, "nexora"],
        "description": f"{full} — şəkilli məhsul kartı, NEXORA zəmanəti və sürətli çatdırılma.",
        "specs": {"Brend": brand, "Kateqoriya": cat, "Zəmanət": "12 ay", "Çatdırılma": "1–3 gün"},
        "images": [
            {"src": i1, "alt": full, "gradient": g},
            {"src": i2, "alt": full + " 2", "gradient": g},
            {"src": i3, "alt": full + " 3", "gradient": g},
        ],
        "gradient": g,
        "reviewList": [{
            "user": random.choice(["Elvin M.", "Aysel R.", "Nigar K.", "Rəşad T.", "Leyla S."]),
            "rating": random.randint(4, 5),
            "date": f"2026-{random.randint(1,7):02d}-{random.randint(1,28):02d}",
            "text": "Şəkillər real məhsula uyğundur, keyfiyyət yaxşıdır.",
        }],
        "image": i1,
    }


def main():
    products = []
    idx = 1
    for cat, sub, pool, brands, names in CATALOG:
        for n_i, name in enumerate(names):
            for v in range(2):  # duplicate variants for volume
                brand, brand_id = brands[(n_i + v) % len(brands)]
                vname = name if v == 0 else f"{name} {['Plus', 'Max', 'Pro', 'Edition'][v % 4]}"
                products.append(make(idx, cat, sub, pool, vname, brand, brand_id))
                idx += 1

    # Extra flood phones + laptops
    for n in range(40):
        brand, brand_id = random.choice([("Samsung", "samsung"), ("Apple", "apple"), ("Xiaomi", "xiaomi")])
        products.append(make(idx, "electronics", "smartphones", "phones", f"Series Phone {n+1}", brand, brand_id))
        idx += 1
    for n in range(40):
        brand, brand_id = random.choice([("Asus", "asus"), ("Lenovo", "lenovo"), ("Apple", "apple"), ("HP", "hp")])
        products.append(make(idx, "electronics", "laptops", "laptops", f"Notebook Line {n+1}", brand, brand_id))
        idx += 1

    assert all(p.get("image") and p["images"][0]["src"] for p in products)

    PRODUCTS_PATH.write_text(
        json.dumps({"version": 3, "products": products}, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    counts = Counter(p["category"] for p in products)
    cats = json.loads(CATEGORIES_PATH.read_text(encoding="utf-8"))
    for c in cats["categories"]:
        real = counts.get(c["id"], 0)
        c["count"] = max(real * 9 + random.randint(50, 160), real)
    CATEGORIES_PATH.write_text(json.dumps(cats, ensure_ascii=False, indent=2), encoding="utf-8")

    print("TOTAL", len(products))
    print(dict(counts))
    print("phones", sum(1 for p in products if p["subcategory"] == "smartphones"))
    print("laptops", sum(1 for p in products if p["subcategory"] == "laptops"))


if __name__ == "__main__":
    main()
