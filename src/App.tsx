import { useMemo, useState } from 'react';
import { Item } from './types';
import { LibraryProvider, useLibrary } from './store';
import { NowView } from './views/NowView';
import { LibraryView } from './views/LibraryView';
import { BacklogView } from './views/BacklogView';
import { StatsView } from './views/StatsView';
import { ItemDialog } from './components/ItemDialog';
import { AddDialog } from './components/AddDialog';
import { SettingsDialog } from './components/SettingsDialog';

type Tab = 'now' | 'library' | 'backlog' | 'stats';

const TABS: { id: Tab; label: string; icon: string }[] = [
  { id: 'now', label: 'Now', icon: '▶' },
  { id: 'library', label: 'Library', icon: '▦' },
  { id: 'backlog', label: 'Want To', icon: '🔖' },
  { id: 'stats', label: 'Stats', icon: '📈' },
];

function Shell() {
  const { items, storageFailed } = useLibrary();
  const [tab, setTab] = useState<Tab>('now');
  const [openId, setOpenId] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Read the open item back out of the store so the dialog always shows live data.
  const openItem = useMemo(() => items.find((i) => i.id === openId) ?? null, [items, openId]);

  const counts = {
    now: items.filter((i) => i.status === 'active').length,
    library: items.length,
    backlog: items.filter((i) => i.status === 'backlog').length,
    stats: 0,
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark">◧</span>
          <span className="brand-name">Shelf</span>
        </div>
        <div className="topbar-actions">
          <button className="btn btn-primary" onClick={() => setAdding(true)}>+ Add</button>
          <button className="icon-btn" onClick={() => setSettingsOpen(true)} aria-label="Settings">⚙</button>
        </div>
      </header>

      {storageFailed && (
        <div className="notice notice-error banner">
          This browser is refusing to save data (private window, or storage is full). Your changes
          will be lost when you close the tab — export a backup from Settings.
        </div>
      )}

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={tab === t.id ? 'tab tab-active' : 'tab'}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span>
            <span className="tab-label">{t.label}</span>
            {counts[t.id] > 0 && <span className="tab-count">{counts[t.id]}</span>}
          </button>
        ))}
      </nav>

      <main className="content">
        {tab === 'now' && <NowView onOpen={(i) => setOpenId(i.id)} onAdd={() => setAdding(true)} />}
        {tab === 'library' && <LibraryView onOpen={(i) => setOpenId(i.id)} onAdd={() => setAdding(true)} />}
        {tab === 'backlog' && <BacklogView onOpen={(i) => setOpenId(i.id)} onAdd={() => setAdding(true)} />}
        {tab === 'stats' && <StatsView onOpen={(i) => setOpenId(i.id)} />}
      </main>

      {openItem && <ItemDialog item={openItem} onClose={() => setOpenId(null)} />}
      {adding && (
        <AddDialog
          onClose={() => setAdding(false)}
          onCreated={(item: Item) => {
            setAdding(false);
            setOpenId(item.id);
          }}
          onOpenSettings={() => {
            setAdding(false);
            setSettingsOpen(true);
          }}
          defaultStatus={tab === 'now' ? 'active' : 'backlog'}
        />
      )}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

export default function App() {
  return (
    <LibraryProvider>
      <Shell />
    </LibraryProvider>
  );
}
