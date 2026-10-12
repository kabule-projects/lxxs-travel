#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""按 CSV mapping 导入明信片/物品到云数据库并激活。
用法: python scripts/import-csv-content.py
"""
import csv
import json
import os
import re
import subprocess
import sys

TCB = os.path.join(os.environ.get('APPDATA', ''), 'npm', 'tcb.cmd')

ENV = 'cloud1-d2g64dostc23dfbce'
BUCKET = 'cloud://cloud1-d2g64dostc23dfbce.636c-cloud1-d2g64dostc23dfbce-1491327870'
ITEMS_CSV = r'C:\Users\陈恒琳\OneDrive\xwechat_files\wxid_vs651cfgdek022_0e01\msg\file\2026-10\items.csv'
PCS_CSV = r'C:\Users\陈恒琳\OneDrive\xwechat_files\wxid_vs651cfgdek022_0e01\msg\file\2026-10\postcards.csv'
CDN_ITEMS = 'cdn_items.txt'   # 已下载的 CDN 文件名清单
CDN_PCS = 'cdn_pc.txt'


def run_nosql(command_obj):
    cmd_json = json.dumps(command_obj, ensure_ascii=False)
    p = subprocess.run(
        [TCB, 'db', 'nosql', 'execute', '--json', '--command', cmd_json, '-e', ENV],
        input='\n', capture_output=True, text=True, encoding='gbk', errors='replace',
    )
    out = p.stdout or p.stderr or ''
    if p.returncode != 0:
        raise RuntimeError('tcb failed: ' + out[:500])
    return out


def numbers(out):
    """从 CLI 输出提取 n / nModified"""
    for marker in ('"nModified"', '"n"'):
        i = out.find(marker)
        if i >= 0:
            j = out.find('"$numberInt"', i)
            if j >= 0:
                k = out.find('"', j + len('"numberInt"') + 2)
                q1 = out.find('"', j + 12)
                q2 = out.find('"', q1 + 1)
                try:
                    return int(out[q1 + 1:q2])
                except ValueError:
                    pass
    return None


def load_list(path):
    with open(path, encoding='utf-8') as f:
        return set(line.strip() for line in f if line.strip())


def sanitize(text):
    """描述清洗：CSV 里 Excel 转出的 ASCII 双引号替换为中文引号，换行替换为空格"""
    return (text or '').replace('"', '”').replace('\r', ' ').replace('\n', ' ').strip()


def existing_ids(collection, id_prefix=None):
    """查回已有文档 id，防止重复导入"""
    filt = {'id': {'$regex': '^' + id_prefix}} if id_prefix else {}
    out = run_nosql([{'TableName': collection, 'CommandType': 'QUERY',
                      'Command': json.dumps({'find': collection, 'filter': filt,
                                             'projection': {'id': 1}, 'limit': 500}, ensure_ascii=False)}])
    ids = set()
    for m in re.finditer(r'"id"\s*:\s*"([^"]+)"', out):
        ids.add(m.group(1))
    return ids


def main():
    cdn_items = load_list(CDN_ITEMS)
    cdn_pcs = load_list(CDN_PCS)

    # ---------- 明信片 ----------
    with open(PCS_CSV, encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f))
    pc_rows = [r for r in rows if r and r[0].strip()]
    print('postcards.csv 数据行:', len(pc_rows))

    new_docs = []
    skipped_existing = 0
    already_in_db = existing_ids('postcards')
    missing_img = []
    for idx, r in enumerate(pc_rows, 1):
        fname = r[0].strip()
        group = (r[1].strip() if len(r) > 1 else '') or 'daily'
        text = sanitize(r[2] if len(r) > 2 else '')
        if fname not in cdn_pcs:
            missing_img.append(fname)
            continue
        pc_id = 'pc_%02d' % idx
        if pc_id in already_in_db:
            skipped_existing += 1
            continue
        title = text.split('——')[-1].strip() if '——' in text else text[:24]
        new_docs.append({
            'id': pc_id,
            'type': 'postcard',
            'groupId': group,
            'rarity': 'R',
            'baseWeight': 10,
            'title': title,
            'story': text,
            'imageThumb': f'{BUCKET}/content/postcards/pa-{idx}.webp',
            'imageFull': f'{BUCKET}/content/postcards/postcard-{idx}.webp',
            'enabled': True,
        })
    print(f'已在库跳过: {skipped_existing}；待新增: {len(new_docs)}；CDN 缺图: {missing_img}')

    BATCH = 10
    for i in range(0, len(new_docs), BATCH):
        chunk = new_docs[i:i + BATCH]
        out = run_nosql([{'TableName': 'postcards', 'CommandType': 'INSERT',
                          'Command': json.dumps({'insert': 'postcards', 'documents': chunk}, ensure_ascii=False)}])
        n = numbers(out)
        print(f'  insert pc_{i + 19:02d}~pc_{i + 19 + len(chunk) - 1:02d} -> n={n}')

    # ---------- 物品 ----------
    NAME_MAP = {
        'silver_necklace': '银项链', 'name_tag': '名牌', 'notebook': '笔记本',
        'pencil': '铅笔', 'clapperboard': '场记板', 'blue_star': '蓝星',
        'stuffed_mimi': '抱抱米', 'stand_mic': '立麦', 'flowers_balloons': '花与气球',
        'bear_sleepwear': '小熊睡衣',
        'fish_mint_bouquet': '鱼腥草花束', 'potato_in_silver': '银饰小土豆',
        'plants': '绿植盆栽', 'trophy': '奖杯', 'train': '小火车',
        'steamship': '轮船', 'selfies': '自拍合影', 'cono_coin': '幸运硬币',
        'light_board': '灯牌', 'prince': '小王子', 'tiramisu': '提拉米苏',
    }
    FILENAME_FIX = {'flowers&baloons.webp': 'flowers&balloons.webp'}

    with open(ITEMS_CSV, encoding='utf-8-sig', newline='') as f:
        item_rows = list(csv.reader(f))[1:]
    item_rows = [r for r in item_rows if r and r[0].strip()]

    food_updates = []
    new_items = []
    missing_item_img = []
    skipped_items = []
    already_items = existing_ids('items')
    for r in item_rows:
        fname = FILENAME_FIX.get(r[0].strip(), r[0].strip())
        category = r[1].strip()
        group = r[2].strip()
        text = sanitize(r[3] if len(r) > 3 else '')
        base = fname.replace('.webp', '')
        if fname not in cdn_items:
            missing_item_img.append(fname)
            continue
        icon = f'{BUCKET}/content/items/{fname}'
        if category == 'food':
            food_updates.append({'q': {'id': 'food_' + base},
                                 'u': {'$set': {'enabled': True, 'icon': icon, 'description': text, 'group': group}}})
        else:
            itype = 'souvenir' if category == 'souvenir' else 'accessory'
            prefix = 'souvenir' if category == 'souvenir' else 'acc'
            iid = f'{prefix}_{base}'
            if iid in already_items:
                skipped_items.append(iid)
                continue
            doc = {
                'id': iid,
                'type': itype,
                'name': NAME_MAP.get(base, base),
                'icon': icon,
                'description': text,
                'category': category,
                'group': group,
                'enabled': True,
            }
            if category == 'souvenir':
                doc['showcase'] = True
            new_items.append(doc)

    print(f'食物激活: {len(food_updates)}；新物品: {len(new_items)}；已在库跳过: {skipped_items}；CDN 缺图: {missing_item_img}')

    if food_updates:
        out = run_nosql([{'TableName': 'items', 'CommandType': 'UPDATE',
                          'Command': json.dumps({'update': 'items', 'updates': food_updates}, ensure_ascii=False)}])
        print('  food updates ->', numbers(out))

    for i in range(0, len(new_items), 9):
        chunk = new_items[i:i + 9]
        out = run_nosql([{'TableName': 'items', 'CommandType': 'INSERT',
                          'Command': json.dumps({'insert': 'items', 'documents': chunk}, ensure_ascii=False)}])
        print(f'  item insert {i}~{i + len(chunk) - 1} ->', numbers(out))

    print('完成')


if __name__ == '__main__':
    main()
