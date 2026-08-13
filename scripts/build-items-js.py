#!/usr/bin/env python3
"""Build public/js/items.js (gallery data) from scripts/item-images.json + pricing data.
Usage: python scripts/build-items-js.py
"""
import json
import os
import re


def slug(name):
    return re.sub(r'[^a-z0-9]+', '-', name.lower()).strip('-')

# Global price factor: 0.2 = 20% of the original price (80% off)
DISCOUNT = 0.2

# Popularity score (0-100) used for the "sort by popularity" option and the popular badge
POP = {
    # styles
    'Superhuman': 90, 'Godhuman': 85, 'Sanguine Art': 75, 'Sharkman Karate': 70,
    'Electric Claw': 65, 'Dragon Talon': 65, 'Death Step': 60,
    # swords
    'Saber': 95, 'Cursed Dual Katana': 88, 'Yama': 80, 'Tushita': 78, 'True Triple Katana': 76,
    'Hallow Scythe': 74, 'Dark Dagger': 72, 'Koko': 70, 'Rengoku': 68, 'Pole (2nd Form)': 66,
    'Canvander': 65, 'Shark Anchor': 64, 'Pole (1st Form)': 62, 'Buddy Sword': 60,
    'Spikey Trident': 58, 'Dragonheart': 56, 'Fox Lamp': 55, 'Triple Dark Blade': 50,
    'Shizu': 42, 'Oroshi': 40, 'Saishi': 38, 'Bisento': 35, 'Midnight Blade': 30,
    # guns
    'Skull Guitar': 85, 'Kabucha': 80, 'Dragonstorm': 72, 'Venom Bow': 65, 'Bazooka': 55,
    # materials
    'Dark Fragment': 82, 'Leviathan Heart': 78, 'Leviathan Scale': 76,
    'Alucard Fragment': 70, 'Azure Ember': 68, 'Mirror Fractal': 62, 'Terror Eyes': 60,
    'Dragon Egg': 58, 'Nightmare Catcher': 55, 'Meteorite': 52, 'Hearts': 50, 'Volt Capsule': 48,
    'Monster Magnet': 45, 'Volcanic Magnet': 45, 'Dinosaur Bones': 45, 'Confetti': 40,
    'Celestial Token': 35, 'Oni Token': 35, 'Summer Token': 35,
}

# name -> (rarity, thb_price, in_game_cost_note, extra_note)
STYLES = {
    'Superhuman':       ('Legendary', 300, '3,000,000 Beli (4 styles @ mastery 300)', ''),
    'Death Step':       ('Legendary', 200, '2,500,000 Beli / 5,000 Frag (Dark Step @ 400)', ''),
    'Sharkman Karate':  ('Legendary', 250, '2,500,000 Beli / 5,000 Frag (Water Kung Fu @ 400)', ''),
    'Electric Claw':    ('Legendary', 300, '3,000,000 Beli / 5,000 Frag (Electric @ 400)', ''),
    'Dragon Talon':     ('Legendary', 300, '3,000,000 Beli / 5,000 Frag (Dragon Breath @ 400)', ''),
    'Godhuman':         ('Mythical', 500, '5,000,000 Beli + materials (5 styles @ 400)', ''),
    'Sanguine Art':     ('Mythical', 600, '5,000,000 Beli + materials (2 Leviathan Heart, Vampire Fang, Demonic Wisp)', ''),
}
SWORDS = {
    'Bisento':            ('Legendary', 100, '1,000,000 Beli (shop)', ''),
    'Midnight Blade':     ('Legendary', 80,  '100 Beli (El Admin)', ''),
    'Oroshi':             ('Legendary', 150, '2,000,000 Beli (shop)', ''),
    'Saishi':             ('Legendary', 150, '2,000,000 Beli (shop)', ''),
    'Shizu':              ('Legendary', 150, '2,000,000 Beli (shop)', ''),
    'Saber':              ('Legendary', 150, 'Drop: Saber Expert', ''),
    'Pole (1st Form)':    ('Legendary', 150, 'Drop: Thunder God', ''),
    'Pole (2nd Form)':    ('Legendary', 250, 'Lightning strike with Pole', ''),
    'Rengoku':            ('Legendary', 200, 'Hidden Key', ''),
    'Spikey Trident':     ('Legendary', 200, 'Drop: Cake Prince / Dough King', ''),
    'Yama':               ('Legendary', 200, '20-30 Elite Hunter quests', ''),
    'Buddy Sword':        ('Legendary', 250, 'Drop: Cake Queen', ''),
    'Tushita':            ('Legendary', 250, 'Drop: Longma', ''),
    'Canvander':          ('Legendary', 300, 'Drop: Beautiful Pirate', ''),
    'Koko':               ('Legendary', 300, 'Drop: Order', ''),
    'Dark Dagger':        ('Legendary', 350, 'Drop: rip_indra (True Form)', ''),
    'Fox Lamp':           ('Legendary', 350, 'Kitsune Shrine', ''),
    'Dragonheart':        ('Legendary', 400, 'Dragon Hunter', ''),
    'Shark Anchor':       ('Mythical', 400, 'Drop: Anchor Terrorshark', ''),
    'Hallow Scythe':      ('Mythical', 350, 'Drop: Soul Reaper', ''),
    'True Triple Katana': ('Mythical', 500, '2,000,000 Beli (Mysterious Man)', ''),
    'Cursed Dual Katana': ('Mythical', 800, 'Scroll Trials', ''),
}
GUNS = {
    'Bazooka':      ('Legendary', 150, 'Drop: Wysper', ''),
    'Kabucha':      ('Legendary', 150, 'The Strongest God', ''),
    'Venom Bow':    ('Legendary', 200, 'Drop: Hydra Leader', ''),
    'Dragonstorm':  ('Legendary', 400, 'Dragon Hunter', ''),
    'Skull Guitar': ('Mythical', 500, 'Craft: Weird Machine', ''),
}
MATERIALS = {
    'Volt Capsule':    ('Legendary', 250, 'Sea Chanter / Ocean Prophet', ''),
    'Meteorite':       ('Legendary', 300, 'Fajita', ''),
    'Leviathan Scale': ('Legendary', 350, 'Leviathan', ''),
    'Terror Eyes':     ('Legendary', 350, 'Terrorshark', ''),
    'Azure Ember':     ('Legendary', 400, 'Kitsune Shrine', ''),
    'Dark Fragment':   ('Mythical', 500, 'Darkbeard', ''),
    'Mirror Fractal':  ('Mythical', 600, 'Dough King', ''),
    'Nightmare Catcher': ('Mythical', 600, 'Reborn Skeleton / Living Zombie', ''),
    'Leviathan Heart': ('Mythical', 600, 'Leviathan', ''),
    'Alucard Fragment': ('Mythical', 800, 'Scroll Trials', ''),
    'Monster Magnet':  ('Mythical', 800, 'Shark Hunter', ''),
    'Volcanic Magnet': ('Mythical', 800, 'Dragon Hunter', ''),
}

CATS = [('styles', 'สไตล์ต่อสู้', 'Fighting Styles', STYLES),
        ('swords', 'ดาบ', 'Swords', SWORDS),
        ('guns', 'ปืน', 'Guns', GUNS),
        ('materials', 'วัสดุ', 'Materials', MATERIALS)]

items = []
for cat, th_label, en_label, table in CATS:
    for name, (rarity, price, cost, note) in table.items():
        img = '/img/items/' + slug(name) + '.webp'
        if not os.path.exists('public' + img):
            print('WARN: missing local image for', name, img)
            continue
        items.append({
            'cat': cat,
            'name': name,
            'img': img,
            'rarity': rarity,
            'price': round(price * DISCOUNT),
            'pop': POP.get(name, 40),
            'cost': cost,
            'note': note,
        })

js = '// Auto-generated by scripts/build-items-js.py — do not edit by hand.\n'
js += 'const GALLERY_CATS = ' + json.dumps(
    [{'id': c, 'th': t, 'en': e} for c, t, e, _ in CATS], ensure_ascii=False) + ';\n'
js += 'const GALLERY_ITEMS = ' + json.dumps(items, ensure_ascii=False) + ';\n'

with open('public/js/items.js', 'w', encoding='utf-8') as f:
    f.write(js)

print('Wrote public/js/items.js with', len(items), 'items')
