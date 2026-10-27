# -*- coding: utf-8 -*-
# 全局一致性扫描：trips 里 status=claimed 的信件 vs user_postcards 图鉴
import json, subprocess, os, sys

TCB = os.path.join(os.environ['APPDATA'], 'npm', 'tcb.cmd')
ENV = 'cloud1-d2g64dostc23dfbce'

def db(cmd_json):
    p = subprocess.run([TCB, 'db', 'nosql', 'execute', '--command', cmd_json, '-e', ENV, '--json'],
                       capture_output=True)
    raw = p.stdout.decode('utf-8', 'surrogatepass')
    i = raw.find('{')
    return json.loads(raw[i:])

# 1) 拉 claimed 信件（尽量多）
trips_batches = []
for skip in (0,):
    r = db('[{"TableName":"trips","CommandType":"QUERY","Command":"{\\"find\\":\\"trips\\",\\"filter\\":{\\"postcards.status\\":\\"claimed\\"},\\"limit\\":500}"}]')
    trips_batches = r['data']['results'][0]

pairs = []
for t in trips_batches:
    for p in t.get('postcards') or []:
        if p.get('status') == 'claimed':
            pairs.append((t.get('userId'), p.get('postcardId'), t.get('_id')))

users = sorted({p[0] for p in pairs})
missing = []
for u in users:
    r = db('[{"TableName":"user_postcards","CommandType":"QUERY","Command":"{\\"find\\":\\"user_postcards\\",\\"filter\\":{\\"userId\\":\\"%s\\"},\\"limit\\":400}"}]' % u)
    album = {x.get('postcardId') for x in r['data']['results'][0]}
    mine = {p[1] for p in pairs if p[0] == u}
    for pc in mine - album:
        trip_ids = [p[2] for p in pairs if p[0] == u and p[1] == pc]
        missing.append({'userId': u, 'postcardId': pc, 'tripId': trip_ids[0]})

out = {
    'sampled_trips': len(trips_batches),
    'claimed_pairs': len(pairs),
    'users': len(users),
    'missing_count': len(missing),
    'missing': missing,
}
open('.tmp-q/mail-loss-scan.json', 'w', encoding='utf-8').write(json.dumps(out, ensure_ascii=False, indent=1))
print('scan done: %d claimed, %d users, %d missing' % (len(pairs), len(users), len(missing)))
