'use client';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div style={{ padding: 40, color: '#f87171' }}>
      <h2>Something went wrong!</h2>
      <pre style={{ background: 'rgba(0,0,0,0.3)', padding: 12, borderRadius: 8, overflow: 'auto' }}>
        {error.message}
      </pre>
      <button onClick={() => reset()} style={{ marginTop: 12, padding: '8px 16px', cursor: 'pointer' }}>
        Try again
      </button>
    </div>
  );
}
