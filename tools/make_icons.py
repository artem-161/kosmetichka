"""Генерирует иконки приложения (баночка крема на розовом фоне) без внешних библиотек.
Запуск из корня проекта:  python3 tools/make_icons.py
"""
import math
import os
import struct
import zlib

OUT = os.path.join(os.path.dirname(__file__), '..', 'icons')

TOP = (232, 150, 175)     # пудровая роза сверху
BOTTOM = (133, 40, 75)    # глубокая роза снизу
WHITE = (255, 255, 255)
LID = (255, 226, 234)


def rrect(x, y, x0, y0, x1, y1, r):
    """Точка внутри скруглённого прямоугольника (координаты 0..1)."""
    cx = min(max(x, x0 + r), x1 - r)
    cy = min(max(y, y0 + r), y1 - r)
    return (x - cx) ** 2 + (y - cy) ** 2 <= r * r and x0 <= x <= x1 and y0 <= y <= y1


def color_at(x, y):
    t = y
    bg = tuple(TOP[i] + (BOTTOM[i] - TOP[i]) * t for i in range(3))
    if rrect(x, y, 0.30, 0.25, 0.70, 0.38, 0.03):      # крышка
        return LID
    if rrect(x, y, 0.24, 0.40, 0.76, 0.76, 0.08):      # баночка
        # сердечко на баночке
        hx, hy = (x - 0.5) / 0.09, (0.585 - y) / 0.09
        if (hx * hx + hy * hy - 1) ** 3 - hx * hx * hy ** 3 <= 0:
            return (196, 82, 118)
        return WHITE
    return bg


def make(size, path, ss=3):
    rows = []
    for py in range(size):
        row = bytearray([0])
        for px in range(size):
            acc = [0, 0, 0]
            for sy in range(ss):
                for sx in range(ss):
                    c = color_at((px + (sx + .5) / ss) / size, (py + (sy + .5) / ss) / size)
                    for i in range(3):
                        acc[i] += c[i]
            row += bytes(int(a / (ss * ss)) for a in acc)
        rows.append(bytes(row))
    raw = zlib.compress(b''.join(rows), 9)

    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    png = b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)) \
        + chunk(b'IDAT', raw) + chunk(b'IEND', b'')
    with open(path, 'wb') as f:
        f.write(png)


if __name__ == '__main__':
    os.makedirs(OUT, exist_ok=True)
    for size, name in [(180, 'apple-touch-icon.png'), (192, 'icon-192.png'), (512, 'icon-512.png')]:
        make(size, os.path.join(OUT, name))
        print('ok', name)
