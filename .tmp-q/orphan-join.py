# -*- coding: utf-8 -*-
# 轻量孤儿扫描+回填：find 分片拉 claimed 对 + 全量拉图鉴键 → 本地 join → 批量回填
import json, subprocess, os, time, io

TCB = os.path.join(os.environ['APPDATA'], 'npm', 'tcb.cmd')
ENV = 'cloud1-d2g64dostc23dfbce'
NOW = int(time.time() * 1000)
DAY = 86400 * 1000

def db(cmd_json, tries=4):
    last = ''
    for t in range(tries):
        p = subprocess.run([TCB, 'db', 'nosql', 'execute', '--command', cmd_json, '-e', ENV, '--json'],
                           capture_output=True)
        raw = p.stdout.decode('utf-8', 'surrogatepass')
        i = raw.find('{')
        d = json.loads(raw[i:]) if i >= 0 else {}
        if 'data' in d:
            return d
        last = raw[:200]
        time.sleep(4 * (t + 1))
    raise RuntimeError(last)

def find_all(table, filter_json, projection, label):
    out = []
    skip = 0
    page = 1000
    while True:
        cmdj = {'find': table, 'filter': filter_json, 'projection': projection, 'limit': page, 'skip': skip}
        cmd = json.dumps([{'TableName': table, 'CommandType': 'QUERY', 'Command': json.dumps(cmdj)}])
        r = db(cmd)
        docs = r['data']['results'][0]
        out.extend(docs)
        if len(docs) < page:
            break
        skip += page
        if skip % 10000 < page:
            print('%s: fetched %d' % (label, skip), flush=True)
    print('%s done: %d docs' % (label, len(out)), flush=True)
    return out

# 1) 近30天 claimed 卡片对
SINCE = NOW - 30 * DAY
trips = find_all('trips', {'updatedAt': {'$gt': SINCE}, 'postcards.status': 'claimed'},
                 {'userId': 1, 'postcards': 1}, 'trips')
pairs = set()
for t in trips:
    u = t.get('userId')
    for p in t.get('postcards') or []:
        if p.get('status') == 'claimed' and u and p.get('postcardId'):
            pairs.add((u, p['postcardId']))
print('claimed pairs: %d (users %d)' % (len(pairs), len({u for u, _ in pairs})), flush=True)

# 2) 全量图鉴键
album_docs = find_all('user_postcards', {}, {'userId': 1, 'postcardId': 1}, 'album')
owned = set()
for a in album_docs:
    if a.get('userId') and a.get('postcardId'):
        owned.add((a['userId'], a['postcardId']))
print('owned pairs: %d' % len(owned), flush=True)

# 3) 孤儿 = claimed - owned
orphans = sorted(pairs - owned)
print('ORPHANS: %d' % len(orphans), flush=True)
io.open('.tmp-q/orphans-joined.json', 'w', encoding='utf-8').write(
    json.dumps([{'userId': u, 'postcardId': p} for u, p in orphans], ensure_ascii=False))

# 4) 批量回填（每批 200）
BATCH = 200
ts = NOW
for i in range(0, len(orphans), BATCH):
    docs = [{'userId': u, 'postcardId': p, 'firstClaimedAt': ts, 'claimCount': 1, 'repaired': True}
            for u, p in orphans[i:i + BATCH]]
    cmd = json.dumps([{'TableName': 'user_postcards', 'CommandType': 'INSERT',
                       'Command': json.dumps({'insert': 'user_postcards', 'documents': docs})}])
    r = db(cmd)
    print('backfilled %d/%d' % (min(i + BATCH, len(orphans)), len(orphans)), flush=True)

print('ALL DONE', flush=True)
