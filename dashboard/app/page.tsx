'use client';
import { useEffect, useState, useCallback } from 'react';
import TicketCard from '@/components/TicketCard';
import { fetchTickets } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import { STATUS_STYLES } from '@/lib/utils';

export default function TicketFeedPage() {
  const [tickets, setTickets] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [liveCount, setLiveCount] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchTickets();
      setTickets(data.tickets || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.on('agent:update', () => { setLiveCount(c => c + 1); load(); });
    socket.on('ticket:resolved', load);
    socket.on('ticket:rejected', load);
    socket.on('hitl:required', load);
    return () => { socket.off('agent:update'); socket.off('ticket:resolved'); socket.off('ticket:rejected'); socket.off('hitl:required'); };
  }, [load]);

  const statuses = ['ALL', 'OPEN', 'ANALYSING', 'AWAITING_APPROVAL', 'RESOLVED', 'FAILED'];
  const filtered = filter === 'ALL' ? tickets : tickets.filter(t => t.status === filter);

  const counts: Record<string, number> = {};
  tickets.forEach(t => { counts[t.status] = (counts[t.status] || 0) + 1; });

  return (
    <div className="p-4 md:p-8 md:py-8 md:px-10 max-w-[900px] w-full mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4 md:gap-0">
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6 }}>🎫 Ticket Feed</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            {tickets.length} tickets total &nbsp;·&nbsp;
            <span style={{ color: 'var(--success)' }}>{counts.RESOLVED || 0} resolved</span> &nbsp;·&nbsp;
            <span style={{ color: '#fb923c' }}>{counts.AWAITING_APPROVAL || 0} awaiting approval</span>
          </p>
        </div>
        {liveCount > 0 && (
          <div className="animate-blink" style={{ fontSize: 13, color: '#a5b4fc', background: 'rgba(99,102,241,0.12)', padding: '6px 12px', borderRadius: 20, border: '1px solid rgba(99,102,241,0.3)' }}>
            ⚡ Live — {liveCount} updates
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s} onClick={() => setFilter(s)} style={{
            padding: '6px 14px', borderRadius: 20, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 500,
            background: filter === s ? 'var(--accent)' : 'var(--bg-card)',
            color: filter === s ? 'white' : 'var(--text-secondary)',
            transition: 'all 0.2s',
          }}>
            {STATUS_STYLES[s]?.icon || ''} {s === 'ALL' ? 'All' : STATUS_STYLES[s]?.label || s}
            {s !== 'ALL' && counts[s] ? <span style={{ marginLeft: 6, opacity: 0.8 }}>({counts[s]})</span> : null}
          </button>
        ))}
      </div>

      {/* Ticket list */}
      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 40 }}>Loading tickets...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div>No tickets found</div>
          <a href="/demo" style={{ color: 'var(--accent)', fontSize: 14, marginTop: 8, display: 'inline-block' }}>Raise a bug →</a>
        </div>
      ) : (
        filtered.map(t => <TicketCard key={t.id} ticket={t} />)
      )}
    </div>
  );
}
