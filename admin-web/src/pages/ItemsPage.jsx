import { useEffect, useState } from 'react';
import { adminCall, isApiConfigured } from '../api/client';

const EMPTY = {
  id: '',
  type: 'food',
  name: '',
  icon: '',
  description: '',
  price: 0,
  durationMinH: 2,
  durationMaxH: 8,
  distanceMin: 1,
  distanceMax: 3,
  shopCategory: 'food',
  shopSort: 0,
  enabled: true,
};

export default function ItemsPage() {
  const [items, setItems] = useState([]);
  const [form, setForm] = useState(EMPTY);
  const [editing, setEditing] = useState(false);
  const [msg, setMsg] = useState('');
  const [err, setErr] = useState('');

  async function load() {
    if (!isApiConfigured()) return;
    setErr('');
    try {
      const data = await adminCall('listItems');
      setItems(data);
    } catch (e) {
      setErr(e.message);
    }
  }

  useEffect(() => { load(); }, []);

  function edit(item) {
    setForm({ ...EMPTY, ...item });
    setEditing(true);
  }

  function reset() {
    setForm(EMPTY);
    setEditing(false);
  }

  async function save(e) {
    e.preventDefault();
    if (!isApiConfigured()) {
      setErr('请配置 admin-web/.env 中的 VITE_ADMIN_API_URL');
      return;
    }
    setErr('');
    setMsg('');
    try {
      if (editing) {
        await adminCall('updateItem', { id: form.id, patch: form });
        setMsg('已更新');
      } else {
        await adminCall('createItem', form);
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
    try {
      await adminCall('deleteItem', { id });
      load();
    } catch (e) {
      setErr(e.message);
    }
  }

  return (
    <section>
      <h2>物品管理</h2>
      {!isApiConfigured() && (
        <p className="warn">未配置 API。复制 .env.example 为 .env 并填写 HTTP 地址。</p>
      )}
      {err && <p className="err">{err}</p>}
      {msg && <p className="ok">{msg}</p>}

      <form className="form" onSubmit={save}>
        <div className="row">
          <label>id<input required value={form.id} disabled={editing} onChange={(e) => setForm({ ...form, id: e.target.value })} /></label>
          <label>type
            <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
              <option value="food">food</option>
              <option value="accessory">accessory</option>
              <option value="equipment">equipment</option>
              <option value="souvenir">souvenir</option>
            </select>
          </label>
          <label>name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
        </div>
        <div className="row">
          <label>price<input type="number" value={form.price} onChange={(e) => setForm({ ...form, price: Number(e.target.value) })} /></label>
          <label>shopCategory
            <select value={form.shopCategory} onChange={(e) => setForm({ ...form, shopCategory: e.target.value })}>
              <option value="food">food</option>
              <option value="accessory">accessory</option>
              <option value="equipment">equipment</option>
            </select>
          </label>
          <label>shopSort<input type="number" value={form.shopSort} onChange={(e) => setForm({ ...form, shopSort: Number(e.target.value) })} /></label>
        </div>
        <div className="row">
          <label>durationMinH<input type="number" step="0.5" value={form.durationMinH} onChange={(e) => setForm({ ...form, durationMinH: Number(e.target.value) })} /></label>
          <label>durationMaxH<input type="number" step="0.5" value={form.durationMaxH} onChange={(e) => setForm({ ...form, durationMaxH: Number(e.target.value) })} /></label>
          <label>distanceMin<input type="number" value={form.distanceMin} onChange={(e) => setForm({ ...form, distanceMin: Number(e.target.value) })} /></label>
          <label>distanceMax<input type="number" value={form.distanceMax} onChange={(e) => setForm({ ...form, distanceMax: Number(e.target.value) })} /></label>
        </div>
        <label>description<textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></label>
        <label>icon 路径<input value={form.icon} onChange={(e) => setForm({ ...form, icon: e.target.value })} /></label>
        <label><input type="checkbox" checked={form.enabled} onChange={(e) => setForm({ ...form, enabled: e.target.checked })} /> 上架</label>
        <div className="actions">
          <button type="submit">{editing ? '更新' : '创建'}</button>
          {editing && <button type="button" onClick={reset}>取消</button>}
        </div>
      </form>

      <table className="table">
        <thead><tr><th>id</th><th>name</th><th>type</th><th>price</th><th>enabled</th><th></th></tr></thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id}>
              <td>{it.id}</td><td>{it.name}</td><td>{it.type}</td><td>{it.price}</td>
              <td>{it.enabled ? '是' : '否'}</td>
              <td>
                <button type="button" onClick={() => edit(it)}>编辑</button>
                <button type="button" onClick={() => remove(it.id)}>删</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
