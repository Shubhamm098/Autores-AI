'use client';
import Link from 'next/link';
import { STATUS_STYLES, SEVERITY_STYLES, timeAgo } from '@/lib/utils';

export default function TicketCard({ ticket }: { ticket: any }) {
  const status = STATUS_STYLES[ticket.status] || STATUS_STYLES.OPEN;
  const severity = SEVERITY_STYLES[ticket.severity] || SEVERITY_STYLES.MEDIUM;

  return (
    <Link href={`/tickets/${ticket.id}`} style={{ textDecoration: 'none', display: 'block' }}>
      <div className="glass animate-slide-in" style={{
        padding: '16px 20px', marginBottom: 10, cursor: 'pointer',
        transition: 'all 0.2s', borderLeft: `3px solid ${severity.dot}`,
      }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'translateX(3px)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'translateX(0)')}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
              <span className="status-badge" style={{ background: severity.bg, color: severity.text, border: `1px solid ${severity.border}` }}>
                {ticket.severity}
              </span>
              <span className="status-badge" style={{ background: status.bg, color: status.text }}>
                {status.icon} {status.label}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{ticket.service}</span>
            </div>
            <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {ticket.title}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)', overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
              {ticket.description}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{timeAgo(ticket.createdAt)}</div>
            {ticket.resolutions?.[0] && (
              <div style={{ fontSize: 11, color: 'var(--success)', marginTop: 4 }}>
                ✓ Fix ready
              </div>
            )}
          </div>
        </div>

        {/* Progress bar for active pipelines */}
        {['ANALYSING','SCOUTING','FIXING','TESTING'].includes(ticket.status) && (
          <div style={{ marginTop: 10, height: 3, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
            <div style={{
              height: '100%', borderRadius: 2,
              background: 'linear-gradient(90deg, var(--accent), var(--accent-2))',
              width: ({ ANALYSING: '20%', SCOUTING: '40%', FIXING: '60%', TESTING: '80%' } as Record<string, string>)[ticket.status],
              transition: 'width 0.5s ease',
              animation: 'pulse-glow 1.5s infinite',
            }} />
          </div>
        )}
      </div>
    </Link>
  );
}
