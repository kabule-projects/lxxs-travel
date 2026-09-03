import { useState } from 'react';
import ItemsPage from './pages/ItemsPage';
import DestinationsPage from './pages/DestinationsPage';
import { isApiConfigured } from './api/client';
import './App.css';

const TABS = [
  { id: 'items', label: '物品' },
  { id: 'destinations', label: '目的地' },
];

export default function App() {
  const [tab, setTab] = useState('items');

  return (
    <div className="app">
      <header>
        <h1>旅行小深 · 内部配置</h1>
        <p className="sub">
          {isApiConfigured() ? 'API 已配置' : '未配置 API — 见 .env.example'}
        </p>
        <nav>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              className={tab === t.id ? 'active' : ''}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </nav>
      </header>
      <main>
        {tab === 'items' && <ItemsPage />}
        {tab === 'destinations' && <DestinationsPage />}
      </main>
    </div>
  );
}
