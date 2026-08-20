'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const nav = [
  { href: '/', icon: '🎫', label: 'Tickets' },
  { href: '/demo', icon: '⚡', label: 'Raise a Bug' },
  { href: '/knowledge-base', icon: '📚', label: 'Knowledge Base' },
  { href: '/metrics', icon: '📊', label: 'Metrics' },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside style={{
      width: 220, flexShrink: 0, background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border)',
      display: 'flex', flexDirection: 'column', padding: '24px 12px',
      position: 'sticky', top: 0, height: '100vh',
    }}>
      {/* Logo */}
      <div style={{ padding: '0 8px 28px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          <span className="gradient-text">AutoRes</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'block', marginTop: 2 }}>AI Ticket Resolution</span>
        </div>
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1 }}>
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item ${path === item.href ? 'active' : ''}`}
            style={{ marginBottom: 4, display: 'flex' }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 8px 0', borderTop: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="animate-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agents online</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Powered by Groq ⚡</div>
      </div>
    </aside>
  );
}
