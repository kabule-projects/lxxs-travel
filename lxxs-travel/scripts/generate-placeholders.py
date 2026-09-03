import os
import textwrap
from PIL import Image, ImageDraw, ImageFont

ASSETS_ROOT = os.path.join(os.path.dirname(__file__), '../miniprogram/assets')

# 代码引用但缺失的资源列表
MISSING = [
    'bag/go-bubble',
    'bag/label-food',
    'bag/label-prop',
    'bag/label-rice',
    'bag/slot-food',
    'bag/slot-prop',
    'bag/slot-rice',
    'depart/btn-wait',
    'depart/panel',
    'diary/letter-btn-claim',
    'diary/letter-date-label',
    'diary/letter-logo',
    'diary/mascot',
    'diary/spine',
    'gacha/btn-draw-1',
    'gacha/btn-draw-5',
    'gacha/btn-spin',
    'home/shenshen-bed',
    'home/shenshen-desk',
    'home/shenshen-table',
    'home/shenshen-window',
    'icons/common/clear',
    'icons/common/thumb-placeholder',
    'icons/diary/envelope-badge',
    'icons/diary/letter-weather-sun',
    'icons/diary/letter-weather-sunset',
    'icons/diary/weather-cloud',
    'icons/diary/weather-rain',
    'icons/diary/weather-sun',
    'icons/home/prepare',
    'inventory/panel',
    'loading/btn-enter-disabled',
    'profile/avatar-placeholder',
    'profile/btn-submit',
    'profile/panel',
    'roof/magic-hat',
    'roof/mail-tip',
    'roof/pigeon',
    'roof/pigeon-mail',
    'settings/panel',
    'settings/title',
    'settings/toggle-off',
    'settings/toggle-on',
    'settings/user-id-bar',
    'shop/btn-buy-disabled',
    'shop/side-btn-bag',
    'shop/side-btn-star',
    'wardrobe/empty',
]

# 按路径前缀分组的默认尺寸
SIZE_BY_PREFIX = {
    'home/shenshen': (300, 400),
    'roof/': (200, 200),
    'bag/': (160, 160),
    'gacha/': (220, 120),
    'shop/': (180, 80),
    'icons/': (80, 80),
    'settings/': (300, 200),
    'profile/': (300, 200),
    'depart/': (240, 160),
    'inventory/': (300, 200),
    'wardrobe/': (300, 300),
    'diary/': (160, 160),
}

COLOR_BY_PREFIX = {
    'home/shenshen': (255, 220, 200),
    'roof/': (200, 220, 255),
    'bag/': (255, 240, 200),
    'gacha/': (255, 200, 220),
    'shop/': (220, 255, 220),
    'icons/': (230, 230, 230),
    'settings/': (240, 240, 255),
    'profile/': (255, 230, 240),
    'depart/': (255, 235, 205),
    'inventory/': (235, 255, 235),
    'wardrobe/': (245, 235, 255),
    'diary/': (255, 245, 230),
}

def get_size_and_color(path):
    for prefix, size in SIZE_BY_PREFIX.items():
        if path.startswith(prefix.replace('/', '')) or ('/' in prefix and path.startswith(prefix.rstrip('/'))):
            color = COLOR_BY_PREFIX.get(prefix, (220, 220, 220))
            return size, color
    return (200, 200), (220, 220, 220)

def generate(path):
    base = os.path.join(ASSETS_ROOT, path)
    if os.path.exists(base + '.webp') or os.path.exists(base + '@2x.webp'):
        return False  # 已存在，跳过

    os.makedirs(os.path.dirname(base), exist_ok=True)
    (w, h), color = get_size_and_color(path)
    img = Image.new('RGBA', (w, h), color + (255,))
    draw = ImageDraw.Draw(img)

    # 边框
    draw.rectangle([0, 0, w - 1, h - 1], outline=(150, 150, 150, 255), width=2)

    # 文字
    try:
        font = ImageFont.truetype('arial.ttf', max(12, min(w, h) // 10))
    except Exception:
        font = ImageFont.load_default()

    name = os.path.basename(path)
    lines = textwrap.wrap(name, width=max(8, w // 12))
    if not lines:
        lines = [name]

    # 估算总高度
    bbox = draw.textbbox((0, 0), 'A', font=font)
    line_h = bbox[3] - bbox[1]
    total_h = len(lines) * line_h + (len(lines) - 1) * 4
    y = (h - total_h) // 2

    for line in lines:
        bb = draw.textbbox((0, 0), line, font=font)
        tw = bb[2] - bb[0]
        x = (w - tw) // 2
        draw.text((x, y), line, fill=(80, 80, 80, 255), font=font)
        y += line_h + 4

    # 保存三份
    img.save(base + '.webp', 'WEBP')
    img.save(base + '@2x.webp', 'WEBP')
    img.save(base + '@3x.webp', 'WEBP')
    return True

if __name__ == '__main__':
    created = 0
    for p in MISSING:
        if generate(p):
            created += 1
            print(f'created placeholder: {p}')
    print(f'\nTotal created: {created}/{len(MISSING)}')
