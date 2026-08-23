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
    <aside className="w-full md:w-[220px] shrink-0 bg-[#1a1d2e] border-b md:border-b-0 md:border-r border-[#2a2e40] flex flex-col p-4 md:sticky md:top-0 h-auto md:h-screen">
      {/* Logo */}
      <div style={{ padding: '0 8px 28px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>
          <span className="gradient-text">AutoRes</span>
          <span style={{ color: 'var(--text-muted)', fontSize: 13, display: 'block', marginTop: 2 }}>AI Ticket Resolution</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-row md:flex-col overflow-x-auto gap-2 mb-4 md:mb-0">
        {nav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`nav-item flex-shrink-0 ${path === item.href ? 'active' : ''}`}
            style={{ marginBottom: 4, display: 'flex' }}
          >
            <span style={{ fontSize: 16 }}>{item.icon}</span>
            {item.label}
          </Link>
        ))}
      </nav>

      {/* Footer */}
      <div className="hidden md:block pt-4 px-2 border-t border-[#2a2e40]">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div className="animate-blink" style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--success)' }} />
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Agents online</span>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8 }}>Powered by Groq ⚡</div>
      </div>
    </aside>
  );
}
