import { useEffect, useState } from 'react';
import { adminCall, isApiConfigured } from '../api/client';

const EMPTY = {
  id: '',
  name: '',
  terrainTags: '',
  distanceTier: 1,
  baseWeight: 10,
  durationMinH: 2,
  durationMaxH: 12,
  souvenirPool: '',
  enabled: true,
};

export default function DestinationsPage() {
  const [list, setList] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');

  async function load() {
    if (!isApiConfigured()) return;
    try {
      setList(await adminCall('listDestinations'));
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function toPayload(f) {
    return {
      ...f,
      terrainTags: f.terrainTags.split(',').map((s) => s.trim()).filter(Boolean),
      souvenirPool: f.souvenirPool.split(',').map((s) => s.trim()).filter(Boolean),
    };
  }

  function edit(row) {
    setForm({
      ...EMPTY,
      ...row,
      terrainTags: (row.terrainTags || []).join(', '),
      souvenirPool: (row.souvenirPool || []).join(', '),
    });
    setEditing(true);
  }

  function reset() {
    setForm(EMPTY);
    setEditing(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!isApiConfigured()) {
      setErr('请配置 VITE_ADMIN_API_URL');
      return;
    }
    setErr('');
    try {
      const payload = toPayload(form);
      if (editing) {
        await adminCall('updateDestination', { id: form.id, patch: payload });
        setMsg('已更新');
      } else {
        await adminCall('createDestination', payload);
        setMsg('已创建');
      }
      reset();
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  async function remove(id) {
    if (!confirm(`删除 ${id}?`)) return;
    await adminCall('deleteDestination', { id });
    load();
  }

  return (
    <section>
      <h2>目的地管理</h2>
      {err && <p className="err">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <form className="form" onSubmit={save}>
        <div className="row">
          <label>id<input required value={form.id} disabled={editing} onChange={(e) => setForm({ ...form, id: e.target.value })} /></label>
          <label>name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>distanceTier<input type="number" value={form.distanceTier} onChange={(e) => setForm({ ...form, distanceTier: Number(e.target.value) })} /></label>
        </div>
        <div className="row">
          <label>baseWeight<input type="number" value={form.baseWeight} onChange={(e) => setForm({ ...form, baseWeight: Number(e.target.value) })} /></label>
          <label>durationMinH<input type="number" step="0.5" value={form.durationMinH} onChange={(e) => setForm({ ...form, durationMinH: Number(e.target.value) })} /></label>
          <label>durationMaxH<input type="number" step="0.5" value={form.durationMaxH} onChange={(e) => setForm({ ...form, durationMaxH: Number(e.target.value) })} /></label>
        </div>
        <label>terrainTags（逗号分隔）<input value={form.terrainTags} onChange={(e) => setForm({ ...form, terrainTags: e.target.value })} /></label>
        <label>souvenirPool（逗号分隔 itemId）<input value={form.souvenirPool} onChange={(e) => setForm({ ...form, souvenirPool: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 启用</label>
        <div className="actions">
          <button type="submit">{editing ? '更新' : '创建'}</button>
          {editing && <button type="button" onClick={reset}>取消</button>}
        </div>
      </form>

      <table className="table">
        <thead><tr><th>id</th><th>name</th><th>tier</th><th>weight</th><th>enabled</th><th></th></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id}>
              <td>{d.id}</td><td>{d.name}</td><td>{d.distanceTier}</td><td>{d.baseWeight}</td>
              <td>{d.enabled ? '是' : '否'}</td>
              <td>
                <button type="button" onClick={() => edit(d)}>编辑</button>
                <button type="button" onClick={() => remove(d.id)}>删</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
