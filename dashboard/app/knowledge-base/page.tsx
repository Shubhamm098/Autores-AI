'use client';
import { useEffect, useState } from 'react';
import { fetchKnowledge } from '@/lib/api';
import { timeAgo } from '@/lib/utils';

export default function KnowledgeBasePage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchKnowledge().then(d => { setEntries(d.entries || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const filtered = entries.filter(e =>
    !search || e.title?.toLowerCase().includes(search.toLowerCase()) ||
    e.bug_type?.toLowerCase().includes(search.toLowerCase()) ||
    e.fix_description?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📚 Knowledge Base</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 28 }}>{entries.length} resolved issues stored. Recurring bugs are auto-resolved using these references.</p>

      <input type="text" value={search} onChange={e => setSearch(e.target.value)}
        placeholder="Search by title, bug type, or fix description..."
        style={{ width: '100%', maxWidth: 500, padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 14, outline: 'none', marginBottom: 24 }}
      />

      {loading ? <div style={{ color: 'var(--text-muted)' }}>Loading...</div>
      : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40 }}>📭</div>
          <div style={{ marginTop: 12 }}>{search ? 'No matches found' : 'Knowledge base is empty. Resolve some tickets first!'}</div>
        </div>
      ) : (
        filtered.map((e, i) => (
          <div key={e.id || i} className="glass animate-slide-in" style={{ padding: '20px 24px', marginBottom: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(99,102,241,0.15)', color: '#a5b4fc', fontWeight: 600 }}>{e.bug_type}</span>
                  {e.times_referenced > 0 && (
                    <span style={{ fontSize: 11, padding: '3px 8px', borderRadius: 4, background: 'rgba(16,185,129,0.1)', color: '#10b981' }}>Referenced {e.times_referenced}×</span>
                  )}
                </div>
                <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 6 }}>{e.title}</div>
                <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8 }}>{e.root_cause}</div>
                <div style={{ fontSize: 13, color: '#4ade80' }}>✓ Fix: {e.fix_description}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>📁 {e.affected_file}</div>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0, marginLeft: 16 }}>{timeAgo(e.created_at)}</div>
            </div>
            {e.tags?.length > 0 && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
                {e.tags.map((tag: string, ti: number) => (
                  <span key={ti} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border)' }}>#{tag}</span>
                ))}
              </div>
            )}
          </div>
        ))
      )}
    </div>
  );
}
