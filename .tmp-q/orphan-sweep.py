# -*- coding: utf-8 -*-
# 分片孤儿扫描：3 天一个窗口，超时重试，逐窗口落盘
import json, subprocess, os, time, io

TCB = os.path.join(os.environ['APPDATA'], 'npm', 'tcb.cmd')
ENV = 'cloud1-d2g64dostc23dfbce'
NOW = int(time.time() * 1000)
DAY = 86400 * 1000

def db(cmd_json, tries=3):
    for t in range(tries):
        p = subprocess.run([TCB, 'db', 'nosql', 'execute', '--command', cmd_json, '-e', ENV, '--json'],
                           capture_output=True)
        raw = p.stdout.decode('utf-8', 'surrogatepass')
        i = raw.find('{')
        d = json.loads(raw[i:]) if i >= 0 else {}
        if 'data' in d:
            return d
        time.sleep(5 * (t + 1))
    raise RuntimeError('failed after retries: ' + raw[:300])

def scan_window(since, until, label):
    pipeline = [
        {'$match': {'updatedAt': {'$gt': since, '$lte': until}, 'postcards.status': 'claimed'}},
        {'$unwind': '$postcards'},
        {'$match': {'postcards.status': 'claimed'}},
        {'$project': {'userId': 1, 'pc': '$postcards.postcardId', '_id': 0}},
        {'$lookup': {
            'from': 'user_postcards',
            'let': {'u': '$userId', 'p': '$pc'},
            'pipeline': [
                {'$match': {'$expr': {'$and': [
                    {'$eq': ['$userId', '$$u']},
                    {'$eq': ['$postcardId', '$$p']},
                ]}}},
                {'$limit': 1},
            ],
            'as': 'owned',
        }},
        {'$match': {'owned': {'$eq': []}}},
        {'$project': {'owned': 0}},
    ]
    cmd = json.dumps([{'TableName': 'trips', 'CommandType': 'COMMAND',
                       'Command': json.dumps({'aggregate': 'trips', 'pipeline': pipeline, 'cursor': {}})}])
    r = db(cmd)
    orphans = []
    for b in r['data']['results']:
        if isinstance(b, list):
            orphans.extend(b)
    path = '.tmp-q/orphans-%s.json' % label
    io.open(path, 'w', encoding='utf-8').write(json.dumps(orphans, ensure_ascii=False))
    print('window %s: %d orphans' % (label, len(orphans)), flush=True)
    return orphans

total = []
# 近 30 天，每 3 天一片
for k in range(10):
    until = NOW - k * 3 * DAY
    since = until - 3 * DAY
    try:
        total.extend(scan_window(since, until, 'w%02d' % k))
    except Exception as e:
        print('window w%02d FAILED: %s' % (k, e), flush=True)
io.open('.tmp-q/orphans-all.json', 'w', encoding='utf-8').write(json.dumps(total, ensure_ascii=False))
print('TOTAL orphans: %d' % len(total))
