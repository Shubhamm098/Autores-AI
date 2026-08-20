'use client';
import { useState } from 'react';
import { submitDecision } from '@/lib/api';

export default function HitlApprovalPanel({ ticket, approval, resolution, testResults, onDecision }: {
  ticket: any; approval: any; resolution: any; testResults: any; onDecision: (d: string) => void;
}) {
  const [comment, setComment] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');

  if (!approval || approval.decision) return null;

  const decide = async (decision: string) => {
    setLoading(decision);
    setError('');
    try {
      await submitDecision(approval.id, { decision, reviewerComment: comment, reviewerEmail: email });
      onDecision(decision);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading('');
    }
  };

  const passed = testResults?.passed || 0;
  const failed = testResults?.failed || 0;
  const total = testResults?.total || passed + failed;
  const allPassed = testResults?.success;

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.08))',
      border: '1px solid rgba(99,102,241,0.3)',
      borderRadius: 12, padding: 24, marginTop: 20,
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
        <div className="animate-blink" style={{ width: 10, height: 10, borderRadius: '50%', background: '#f97316', flexShrink: 0 }} />
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fb923c' }}>⏸ HITL Approval Required</h3>
      </div>

      {/* Test Results Summary */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#10b981' }}>{passed}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tests Passed</div>
        </div>
        {failed > 0 && (
          <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', textAlign: 'center' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#ef4444' }}>{failed}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Tests Failed</div>
          </div>
        )}
        <div style={{ padding: '10px 16px', borderRadius: 8, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)', textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#a5b4fc' }}>{total}</div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Total</div>
        </div>
      </div>

      {/* Individual test results */}
      {testResults?.tests?.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          {testResults.tests.map((t: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ color: t.status === 'passed' ? '#10b981' : '#ef4444', fontSize: 14, flexShrink: 0, marginTop: 1 }}>
                {t.status === 'passed' ? '✓' : '✕'}
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: t.status === 'passed' ? 'var(--text-primary)' : '#f87171' }}>{t.name}</div>
                {t.failureMessage && (
                  <div className="code" style={{ fontSize: 11, color: '#f87171', marginTop: 4, padding: '4px 8px', background: 'rgba(239,68,68,0.08)', borderRadius: 4 }}>
                    {t.failureMessage.replace(/\x1B\[\d+m/g, '').slice(0, 200)}
                  </div>
                )}
              </div>
              {t.duration && <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{t.duration}ms</span>}
            </div>
          ))}
        </div>
      )}

      {/* Comment */}
      <textarea
        value={comment}
        onChange={e => setComment(e.target.value)}
        placeholder="Add a comment (optional, required for rejection)..."
        rows={2}
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', resize: 'vertical', marginBottom: 12,
          outline: 'none',
        }}
      />
      <input
        type="email"
        value={email}
        onChange={e => setEmail(e.target.value)}
        placeholder="Your email (optional, for notification)"
        style={{
          width: '100%', padding: '10px 12px', borderRadius: 8, fontSize: 13,
          background: 'rgba(0,0,0,0.3)', border: '1px solid var(--border)',
          color: 'var(--text-primary)', marginBottom: 16, outline: 'none',
        }}
      />

      {error && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {error}</div>}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => decide('APPROVED')} disabled={!!loading} style={{
          padding: '11px 24px', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          background: 'linear-gradient(135deg, #10b981, #059669)', color: 'white',
          opacity: loading && loading !== 'APPROVED' ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          {loading === 'APPROVED' ? '⟳ Applying...' : '✅ Approve & Merge'}
        </button>
        <button onClick={() => decide('REJECTED')} disabled={!!loading} style={{
          padding: '11px 24px', borderRadius: 8, border: '1px solid rgba(239,68,68,0.4)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          background: 'rgba(239,68,68,0.1)', color: '#f87171',
          opacity: loading && loading !== 'REJECTED' ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          {loading === 'REJECTED' ? '⟳ Rejecting...' : '❌ Reject'}
        </button>
        <button onClick={() => decide('RETESTREQUEST')} disabled={!!loading} style={{
          padding: '11px 24px', borderRadius: 8, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          background: 'rgba(99,102,241,0.1)', color: '#a5b4fc',
          opacity: loading && loading !== 'RETESTREQUEST' ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          {loading === 'RETESTREQUEST' ? '⟳ Requesting...' : '🔁 Re-test'}
        </button>
        <button onClick={() => decide('ESCALATED')} disabled={!!loading} style={{
          padding: '11px 24px', borderRadius: 8, border: '1px solid rgba(234,179,8,0.4)', cursor: 'pointer', fontWeight: 600, fontSize: 14,
          background: 'rgba(234,179,8,0.1)', color: '#facc15',
          opacity: loading && loading !== 'ESCALATED' ? 0.5 : 1, transition: 'all 0.2s',
        }}>
          {loading === 'ESCALATED' ? '⟳ Escalating...' : '⚠️ Escalate'}
        </button>
      </div>
    </div>
  );
}
