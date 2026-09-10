# -*- coding: utf-8 -*-
"""音效转码：微信转来的 wav/mp3 → miniprogram/assets/sfx/ 下的英文命名 mp3。

用法：.venv-sfx/Scripts/python scripts/convert-sfx.py [源目录]
默认源：微信文件目录下的「音效」文件夹。
新增音效时在 RENAME_MAP 加一行映射即可。
"""
import os
import shutil
import sys
import wave

import lameenc

SRC_DEFAULT = r'C:/Users/陈恒琳/OneDrive/xwechat_files/wxid_vs651cfgdek022_0e01/msg/file/2026-09/音效(2)/音效/音效'
OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'miniprogram', 'assets', 'sfx')

# 中文文件名（不含扩展名）→ 英文 key
RENAME_MAP = {
    '按键通用(1)': 'tap',
    '拾取星星': 'star',
    '日记本翻页': 'diary_flip',
    '点击日记本': 'diary_open',
    '纪念品柜': 'showcase_open',
    '翻窗': 'window',
    '鸽子飞走': 'pigeon_fly',
    '扭蛋机投币': 'gacha_coin',
    '扭蛋结果': 'gacha_result',
    '扭蛋掉出来': 'gacha_drop',
}

BITRATE_KBPS = 128


def wav_to_pcm16(path: str) -> tuple[int, int, bytes]:
    """读取 wav，统一转成 16bit PCM（24bit 取高两位）。"""
    with wave.open(path) as w:
        rate, ch, width = w.getframerate(), w.getnchannels(), w.getsampwidth()
        frames = w.readframes(w.getnframes())
    if width == 2:
        pcm = frames
    elif width == 3:
        # 24bit → 16bit：丢弃每 3 字节样本的最低字节
        pcm = bytearray()
        for i in range(0, len(frames) - 2, 3):
            pcm += frames[i:i + 2]
        pcm = bytes(pcm)
    elif width == 1:
        pcm = bytes((b - 128) << 8 for b in frames)
    else:
        raise ValueError(f'不支持的位宽 {width * 8}bit')
    return rate, ch, pcm


def encode_mp3(rate: int, ch: int, pcm: bytes, out_path: str):
    enc = lameenc.Encoder()
    enc.set_bit_rate(BITRATE_KBPS)
    enc.set_in_sample_rate(rate)
    enc.set_channels(ch)
    enc.set_quality(2)
    with open(out_path, 'wb') as f:
        f.write(enc.encode(pcm) + enc.flush())


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else SRC_DEFAULT
    os.makedirs(OUT_DIR, exist_ok=True)
    done, missing = [], []
    for zh, key in RENAME_MAP.items():
        wav_p = os.path.join(src, zh + '.wav')
        mp3_p = os.path.join(src, zh + '.mp3')
        out = os.path.join(OUT_DIR, key + '.mp3')
        if os.path.exists(wav_p):
            rate, ch, pcm = wav_to_pcm16(wav_p)
            encode_mp3(rate, ch, pcm, out)
            done.append(f'{zh}.wav -> {key}.mp3 ({rate}Hz {ch}ch)')
        elif os.path.exists(mp3_p):
            shutil.copyfile(mp3_p, out)
            done.append(f'{zh}.mp3 -> {key}.mp3 (直接拷贝)')
        else:
            missing.append(zh)
    for line in done:
        print('OK ', line)
    for zh in missing:
        print('MISS', zh)
    print(f'输出目录: {os.path.abspath(OUT_DIR)}')


if __name__ == '__main__':
    main()
