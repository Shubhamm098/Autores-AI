'use client';

export default function CodeDiffViewer({ diff }: { diff: string }) {
  if (!diff) return <div style={{ color: 'var(--text-muted)', padding: 16 }}>No diff available</div>;

  const lines = diff.split('\n');

  return (
    <div className="code" style={{
      background: '#0d1117', border: '1px solid var(--border)', borderRadius: 8,
      overflow: 'auto', maxHeight: 400, fontSize: 12, lineHeight: 1.6,
    }}>
      {lines.map((line, i) => {
        let bg = 'transparent';
        let color = '#8b949e';
        if (line.startsWith('+') && !line.startsWith('+++')) { bg = 'rgba(16,185,129,0.12)'; color = '#56d364'; }
        else if (line.startsWith('-') && !line.startsWith('---')) { bg = 'rgba(239,68,68,0.1)'; color = '#f85149'; }
        else if (line.startsWith('@@')) { bg = 'rgba(99,102,241,0.1)'; color = '#79c0ff'; }
        else if (line.startsWith('---') || line.startsWith('+++')) { color = '#c9d1d9'; }

        return (
          <div key={i} style={{ display: 'flex', background: bg }}>
            <span style={{ color: 'var(--text-muted)', padding: '0 12px', minWidth: 40, textAlign: 'right', userSelect: 'none', flexShrink: 0 }}>{i + 1}</span>
            <span style={{ color, padding: '0 12px', whiteSpace: 'pre', flex: 1, overflowX: 'auto' }}>{line || ' '}</span>
          </div>
        );
      })}
    </div>
  );
}
