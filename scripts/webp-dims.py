#!/usr/bin/env python3
"""Read WebP dimensions by parsing RIFF/VP8X/VP8/VP8L headers (no PIL needed)."""
import struct
import sys
import os


def webp_size(path):
    with open(path, 'rb') as f:
        data = f.read(64)
    if data[0:4] != b'RIFF' or data[8:12] != b'WEBP':
        raise ValueError('not a webp: %s' % path)
    fourcc = data[12:16]
    if fourcc == b'VP8X':
        # canvas width/height minus one, 24-bit LE at offsets 24 and 27
        w = 1 + int.from_bytes(data[24:27], 'little')
        h = 1 + int.from_bytes(data[27:30], 'little')
        return w, h
    if fourcc == b'VP8 ':
        # frame tag at offset 20: 3 bytes, then 0x9d012a, then 14-bit width/height
        sig = data[23:26]
        if sig != b'\x9d\x01\x2a':
            raise ValueError('bad vp8 sig: %s' % path)
        w = struct.unpack('<H', data[26:28])[0] & 0x3FFF
        h = struct.unpack('<H', data[28:30])[0] & 0x3FFF
        return w, h
    if fourcc == b'VP8L':
        b = data[21:25]
        bits = int.from_bytes(b, 'little')
        w = (bits & 0x3FFF) + 1
        h = ((bits >> 14) & 0x3FFF) + 1
        return w, h
    raise ValueError('unknown fourcc %r in %s' % (fourcc, path))


files = sys.argv[1:]
for p in files:
    try:
        w, h = webp_size(p)
        print('%s %dx%d ratio=%.6f' % (p, w, h, h / w))
    except Exception as e:
        print('%s ERROR %s' % (p, e))
