'use client';
import { formatDuration } from '@/lib/utils';

const AGENT_ICONS: Record<string, string> = {
  KnowledgeAgent: '📚',
  AnalyserAgent: '🔍',
  CodeScoutAgent: '🔎',
  FixerAgent: '🛠️',
  TesterAgent: '🧪',
};

export default function AgentTimeline({ agentRuns, liveSteps }: { agentRuns: any[]; liveSteps?: any[] }) {
  const steps = [...(agentRuns || []), ...(liveSteps || [])].slice(0, 20);

  if (!steps.length) {
    return <div style={{ color: 'var(--text-muted)', padding: 20, textAlign: 'center', fontSize: 14 }}>No agent activity yet</div>;
  }

  return (
    <div style={{ padding: '4px 0' }}>
      {steps.map((run, i) => (
        <div key={`${run.id || 'step'}-${i}`} className="agent-step">
          {/* Connector */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 24, flexShrink: 0 }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13,
              background: run.status === 'SUCCESS' ? 'rgba(16,185,129,0.15)' : run.status === 'FAILED' ? 'rgba(239,68,68,0.15)' : 'rgba(99,102,241,0.15)',
              border: `1px solid ${run.status === 'SUCCESS' ? '#10b981' : run.status === 'FAILED' ? '#ef4444' : '#6366f1'}`,
              animation: (!run.status || run.status === 'RUNNING') ? 'pulse-running 1.5s infinite' : 'none'
            }}>
              {run.status === 'SUCCESS' ? '✓' : run.status === 'FAILED' ? '✕' : (!run.status || run.status === 'RUNNING') ? '⟳' : AGENT_ICONS[run.agentName] || '•'}
            </div>
            {i < steps.length - 1 && <div className="step-line" style={{ flex: 1, minHeight: 16, marginTop: 4 }} />}
          </div>

          {/* Content */}
          <div style={{ flex: 1, paddingBottom: 12, opacity: (!run.status || run.status === 'RUNNING') ? 1 : 0.7 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: (!run.status || run.status === 'RUNNING') ? '#6366f1' : 'var(--text-primary)' }}>
                {AGENT_ICONS[run.agentName] || '🤖'} {run.agentName || run.step || 'Agent'}
                {run.attempt > 1 && <span style={{ color: 'var(--warning)', marginLeft: 6, fontSize: 11 }}>attempt {run.attempt}</span>}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                {run.durationMs && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{formatDuration(run.durationMs)}</span>}
                <span style={{ fontSize: 11, padding: '2px 6px', borderRadius: 4,
                  background: run.status === 'SUCCESS' ? 'rgba(16,185,129,0.1)' : run.status === 'FAILED' ? 'rgba(239,68,68,0.1)' : 'rgba(99,102,241,0.1)',
                  color: run.status === 'SUCCESS' ? '#10b981' : run.status === 'FAILED' ? '#ef4444' : '#6366f1',
                }}>{run.status || 'RUNNING'}</span>
              </div>
            </div>
            {run.output && typeof run.output === 'object' && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: 6 }}>
                {run.output.fixDescription || run.output.rootCause || run.output.file ||
                  (run.output.passed !== undefined ? `✓ ${run.output.passed} passed, ✕ ${run.output.failed} failed` : JSON.stringify(run.output).slice(0, 120))}
              </div>
            )}
            {run.data && (
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>
                {typeof run.data === 'string' ? run.data : (run.data.message || JSON.stringify(run.data).slice(0, 100))}
              </div>
            )}
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes pulse-running {
          0% { box-shadow: 0 0 0 0 rgba(99,102,241, 0.4); transform: scale(1); }
          70% { box-shadow: 0 0 0 6px rgba(99,102,241, 0); transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(99,102,241, 0); transform: scale(1); }
        }
      `}} />
    </div>
  );
}
