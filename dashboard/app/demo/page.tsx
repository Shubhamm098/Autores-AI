'use client';
import { useState } from 'react';
import { createTicket } from '@/lib/api';
import { useRouter } from 'next/navigation';

const PRESETS = [
  {
    label: '🛒 Checkout Race Condition',
    data: {
      title: 'E-Commerce: Race condition in checkout allows negative stock',
      description: 'When two users checkout simultaneously for the same item with 1 stock remaining, both requests pass the inventory check and deduct stock, resulting in -1 stock for the product.',
      stackTrace: 'Error: Expect stock to be >= 0 but got -1\n    at processCheckout (src/routes/cart.js:45)',
      severity: 'CRITICAL', service: 'cart-service', affectedUrl: 'POST /api/cart/checkout',
    },
  },
  {
    label: '💸 Discount Rounding Error',
    data: {
      title: 'E-Commerce: Rounding error on discount calculation',
      description: 'The discount endpoint uses Math.floor when applying a percentage discount, which drops decimal precision incorrectly and causes accounting discrepancies.',
      stackTrace: 'AssertionError: expected 9.34 to be close to 9.3415\n    at calculateDiscount (src/routes/cart.js:62)',
      severity: 'MEDIUM', service: 'cart-service', affectedUrl: 'POST /api/cart/discount',
    },
  },
];

export default function DemoPage() {
  const router = useRouter();
  const [selected, setSelected] = useState<number | null>(null);
  const [custom, setCustom] = useState({ title: '', description: '', stackTrace: '', severity: 'MEDIUM', service: '', affectedUrl: '' });
  const [mode, setMode] = useState<'preset' | 'custom'>('preset');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const raise = async () => {
    const data = mode === 'preset' && selected !== null ? PRESETS[selected].data : { ...custom, stackTrace: custom.stackTrace || undefined };
    if (!data.title || !data.service) { setError('Title and service are required'); return; }
    setLoading(true); setError('');
    try {
      const res = await createTicket({ ...data, reportedBy: 'demo-ui' });
      router.push(`/tickets/${res.ticket.id}`);
    } catch (e: any) {
      setError(e.message);
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '32px 40px', maxWidth: 800 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>⚡ Raise a Bug</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>Trigger the full agent pipeline by raising a bug ticket. Watch agents resolve it in real-time.</p>

      {/* Mode selector */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 28 }}>
        {(['preset', 'custom'] as const).map(m => (
          <button key={m} onClick={() => setMode(m)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 600,
            background: mode === m ? 'var(--accent)' : 'var(--bg-card)',
            color: mode === m ? 'white' : 'var(--text-secondary)', transition: 'all 0.2s',
          }}>{m === 'preset' ? '🎯 Use Preset Bug' : '✏️ Custom Bug'}</button>
        ))}
      </div>

      {mode === 'preset' ? (
        <div style={{ display: 'grid', gap: 10, marginBottom: 28 }}>
          {PRESETS.map((p, i) => (
            <div key={i} onClick={() => setSelected(i)} style={{
              padding: '16px 20px', borderRadius: 10, cursor: 'pointer',
              border: `1px solid ${selected === i ? 'var(--accent)' : 'var(--border)'}`,
              background: selected === i ? 'rgba(99,102,241,0.08)' : 'var(--bg-card)',
              transition: 'all 0.2s',
            }}>
              <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 4 }}>{p.label}</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>{p.data.description.slice(0, 100)}...</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 6 }}>{p.data.service} · {p.data.severity}</div>
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginBottom: 28 }}>
          {[['Title', 'title', 'text'], ['Service', 'service', 'text'], ['Severity', 'severity', 'select'], ['Affected URL', 'affectedUrl', 'text']].map(([label, key, type]) => (
            <div key={key}>
              <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>{label}</label>
              {type === 'select' ? (
                <select value={(custom as any)[key]} onChange={e => setCustom(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13 }}>
                  {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map(s => <option key={s}>{s}</option>)}
                </select>
              ) : (
                <input type="text" value={(custom as any)[key]} onChange={e => setCustom(p => ({ ...p, [key]: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, outline: 'none' }} />
              )}
            </div>
          ))}
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Description</label>
            <textarea value={custom.description} onChange={e => setCustom(p => ({ ...p, description: e.target.value }))} rows={4}
              style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: 13, resize: 'vertical', outline: 'none' }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: 13, color: 'var(--text-secondary)', marginBottom: 6 }}>Stack Trace (optional)</label>
            <textarea value={custom.stackTrace} onChange={e => setCustom(p => ({ ...p, stackTrace: e.target.value }))} rows={3}
              className="code" style={{ width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-card)', color: '#f87171', fontSize: 12, resize: 'vertical', outline: 'none' }} />
          </div>
        </div>
      )}

      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 16 }}>⚠ {error}</div>}

      <button onClick={raise} disabled={loading || (mode === 'preset' && selected === null)} style={{
        padding: '14px 36px', borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 15, fontWeight: 700,
        background: loading ? 'var(--bg-card)' : 'linear-gradient(135deg, var(--accent), var(--accent-2))',
        color: 'white', transition: 'all 0.2s',
        opacity: (mode === 'preset' && selected === null) ? 0.5 : 1,
        boxShadow: loading ? 'none' : '0 4px 20px rgba(99,102,241,0.4)',
      }}>
        {loading ? '⟳ Raising ticket & starting pipeline...' : '🚀 Raise Bug & Start Agents'}
      </button>
    </div>
  );
}
