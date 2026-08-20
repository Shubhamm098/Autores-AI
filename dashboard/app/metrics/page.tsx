'use client';
import { useEffect, useState } from 'react';
import { fetchMetrics } from '@/lib/api';
import MetricCard from '@/components/MetricCard';
import { formatDuration } from '@/lib/utils';

export default function MetricsPage() {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchMetrics().then(d => { setMetrics(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  if (loading) return <div style={{ padding: 40, color: 'var(--text-muted)' }}>Loading metrics...</div>;
  if (!metrics) return <div style={{ padding: 40, color: '#f87171' }}>Failed to load metrics</div>;

  const { summary, byService, bySeverity, agentPerformance, recentActivity } = metrics;

  return (
    <div style={{ padding: '32px 40px', maxWidth: 1000 }}>
      <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 8 }}>📊 Metrics</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 32 }}>System-wide performance and resolution analytics.</p>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        <MetricCard label="Total Tickets" value={summary.total} icon="🎫" color="#6366f1" />
        <MetricCard label="Resolved" value={summary.resolved} icon="✅" color="#10b981" sub={`${summary.resolutionRate}% rate`} />
        <MetricCard label="Awaiting Approval" value={summary.awaiting} icon="👤" color="#f97316" />
        <MetricCard label="Failed" value={summary.failed} icon="💥" color="#ef4444" />
        <MetricCard label="Mean Time to Resolve" value={summary.mttr ? `${summary.mttr}m` : 'N/A'} icon="⏱️" color="#8b5cf6" sub="avg minutes" />
        <MetricCard label="Open" value={summary.open} icon="📋" color="#60a5fa" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 24 }}>
        {/* By Service */}
        <div className="glass" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Tickets by Service</h3>
          {byService?.map((s: any) => (
            <div key={s.service} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 13 }}>{s.service}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#a5b4fc' }}>{s._count.id}</span>
            </div>
          ))}
        </div>

        {/* By Severity */}
        <div className="glass" style={{ padding: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Tickets by Severity</h3>
          {bySeverity?.map((s: any) => {
            const colors: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#eab308', LOW: '#22c55e' };
            return (
              <div key={s.severity} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ fontSize: 13, color: colors[s.severity] || 'white' }}>● {s.severity}</span>
                <span style={{ fontSize: 13, fontWeight: 600 }}>{s._count.id}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Agent Activity */}
      <div className="glass" style={{ padding: 20 }}>
        <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, color: 'var(--text-secondary)' }}>Recent Agent Activity</h3>
        {recentActivity?.slice(0, 10).map((run: any) => (
          <div key={run.id} style={{ display: 'flex', gap: 12, padding: '8px 0', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: run.status === 'SUCCESS' ? '#10b981' : '#ef4444', minWidth: 60 }}>{run.status}</span>
            <span style={{ fontSize: 13, flex: 1 }}>{run.agentName}</span>
            <span style={{ fontSize: 12, color: 'var(--text-muted)', flex: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{run.ticket?.title}</span>
            {run.durationMs && <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDuration(run.durationMs)}</span>}
          </div>
        ))}
      </div>
    </div>
  );
}
