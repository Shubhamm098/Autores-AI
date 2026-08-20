'use client';
import { useEffect, useState, useCallback } from 'react';
import { fetchTicket } from '@/lib/api';
import { getSocket } from '@/lib/socket';
import AgentTimeline from '@/components/AgentTimeline';
import HitlApprovalPanel from '@/components/HitlApprovalPanel';
import CodeDiffViewer from '@/components/CodeDiffViewer';
import { STATUS_STYLES, SEVERITY_STYLES, timeAgo } from '@/lib/utils';

export default function TicketDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [ticket, setTicket] = useState<any>(null);
  const [liveSteps, setLiveSteps] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'timeline'|'diff'|'tests'>('timeline');

  const load = useCallback(async () => {
    try {
      const data = await fetchTicket(id);
      setTicket(data.ticket);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, [id]);

  const startAgents = async () => {
    try {
      setLiveSteps([]);
      setLoading(true);
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/tickets/${id}/run`, { method: 'POST' });
      if (!res.ok) {
        console.error('Failed to start pipeline:', await res.text());
      }
      await load();
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    const socket = getSocket();
    socket.emit('subscribe:ticket', id);
    socket.on('agent:update', (data: any) => {
      if (data.ticketId === id) {
        setLiveSteps(prev => [...prev.slice(-10), { ...data, id: Date.now() }]);
        load();
      }
    });
    socket.on('hitl:required', (data: any) => { if (data.ticketId === id) load(); });
    socket.on('ticket:resolved', (data: any) => { if (data.ticketId === id) load(); });
    return () => {
      socket.emit('unsubscribe:ticket', id);
      socket.off('agent:update'); socket.off('hitl:required'); socket.off('ticket:resolved');
    };
  }, [id, load]);

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading...</div>;
  if (!ticket) return <div style={{ padding: 40, color: '#f87171' }}>Ticket not found</div>;

  const resolution = ticket.resolutions?.[0];
  const approval = ticket.hitlApprovals?.[0];
  const status = STATUS_STYLES[ticket.status] || STATUS_STYLES.OPEN;
  const severity = SEVERITY_STYLES[ticket.severity] || SEVERITY_STYLES.MEDIUM;

  const tabs = [
    { key: 'timeline', label: '📋 Agent Timeline' },
    { key: 'diff', label: '📄 Code Diff', disabled: !resolution },
    { key: 'tests', label: '🧪 Test Results', disabled: !resolution },
  ];

  return (
    <div style={{ padding: '32px 40px', maxWidth: 900 }}>
      {/* Back link */}
      <a href="/" style={{ color: 'var(--text-muted)', fontSize: 13, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 20 }}>← Back to Tickets</a>

      {/* Ticket header */}
      <div className="glass" style={{ padding: '24px 28px', marginBottom: 24, borderLeft: `4px solid ${severity.dot}`, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
            <span className="status-badge" style={{ background: severity.bg, color: severity.text, border: `1px solid ${severity.border}` }}>{ticket.severity}</span>
            <span className="status-badge" style={{ background: status.bg, color: status.text }}>{status.icon} {status.label}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 8px' }}>{ticket.service}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', padding: '3px 8px' }}>Reported by: {ticket.reportedBy}</span>
          </div>
          <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 12 }}>{ticket.title}</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14, lineHeight: 1.7, marginBottom: 12 }}>{ticket.description}</p>
          {ticket.stackTrace && (
            <pre className="code" style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, fontSize: 12, color: '#f87171', overflow: 'auto', maxHeight: 180 }}>
              {ticket.stackTrace}
            </pre>
          )}
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 12 }}>
            Created {timeAgo(ticket.createdAt)}
            {ticket.resolvedAt && ` · Resolved ${timeAgo(ticket.resolvedAt)}`}
          </div>
        </div>

        {!['RESOLVED', 'APPROVED'].includes(ticket.status) && (
          <button onClick={startAgents} disabled={loading} className="btn-primary" style={{ padding: '8px 16px', fontSize: 13, flexShrink: 0, opacity: loading ? 0.6 : 1 }}>
            {loading ? '⏳ Running...' : ticket.status === 'AWAITING_APPROVAL' ? '🔄 Re-run Agents' : ticket.status === 'OPEN' ? '🚀 Start Agents' : '🚀 Retry Agents'}
          </button>
        )}
      </div>

      {/* HITL Panel */}
      {ticket.status === 'AWAITING_APPROVAL' && approval && resolution && (
        <HitlApprovalPanel
          ticket={ticket}
          approval={approval}
          resolution={resolution}
          testResults={resolution.testResults}
          onDecision={() => load()}
        />
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 16, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {tabs.map(tab => (
          <button key={tab.key} onClick={() => !tab.disabled && setActiveTab(tab.key as any)}
            style={{
              padding: '10px 16px', border: 'none', cursor: tab.disabled ? 'not-allowed' : 'pointer',
              background: 'none', fontSize: 13, fontWeight: 500,
              color: tab.disabled ? 'var(--text-muted)' : activeTab === tab.key ? '#a5b4fc' : 'var(--text-secondary)',
              borderBottom: activeTab === tab.key ? '2px solid var(--accent)' : '2px solid transparent',
              transition: 'all 0.2s', opacity: tab.disabled ? 0.5 : 1,
            }}>
            {tab.label}
          </button>
        ))}
      </div>

      <div className="glass" style={{ padding: 20 }}>
        {activeTab === 'timeline' && (
          <AgentTimeline agentRuns={ticket.agentRuns} liveSteps={liveSteps} />
        )}
        {activeTab === 'diff' && resolution && (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 4 }}>
                📁 <span className="code" style={{ color: '#a5b4fc' }}>{resolution.affectedFile}</span>
                {resolution.affectedLine && <span style={{ color: 'var(--text-muted)' }}> · Line {resolution.affectedLine}</span>}
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-primary)' }}>{resolution.fixDescription}</div>
            </div>
            <CodeDiffViewer diff={resolution.diffPatch} />
          </div>
        )}
        {activeTab === 'tests' && resolution && (
          <div>
            {Array.isArray((resolution.testResults as any)?.tests)
              ? (resolution.testResults as any).tests.map((t: any, i: number) => (
                  <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: t.status === 'passed' ? '#10b981' : '#ef4444' }}>{t.status === 'passed' ? '✓' : '✕'}</span>
                    <div>
                      <div style={{ fontSize: 13 }}>{t.name}</div>
                      {t.failureMessage && <div style={{ fontSize: 12, color: '#f87171', marginTop: 4 }}>{t.failureMessage.replace(/\x1B\[\d+m/g, '').slice(0, 300)}</div>}
                    </div>
                  </div>
                ))
              : <pre style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{JSON.stringify(resolution.testResults, null, 2)}</pre>
            }
          </div>
        )}
      </div>
    </div>
  );
}
