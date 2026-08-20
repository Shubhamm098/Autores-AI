export const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  CRITICAL: { bg: 'rgba(239,68,68,0.12)', text: '#f87171', border: 'rgba(239,68,68,0.3)', dot: '#ef4444' },
  HIGH:     { bg: 'rgba(249,115,22,0.12)', text: '#fb923c', border: 'rgba(249,115,22,0.3)', dot: '#f97316' },
  MEDIUM:   { bg: 'rgba(234,179,8,0.12)', text: '#facc15', border: 'rgba(234,179,8,0.3)', dot: '#eab308' },
  LOW:      { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', border: 'rgba(34,197,94,0.3)', dot: '#22c55e' },
};

export const STATUS_STYLES: Record<string, { bg: string; text: string; label: string; icon: string }> = {
  OPEN:              { bg: 'rgba(99,102,241,0.12)', text: '#a5b4fc', label: 'Open', icon: '📋' },
  ANALYSING:         { bg: 'rgba(168,85,247,0.12)', text: '#c084fc', label: 'Analysing', icon: '🔍' },
  SCOUTING:          { bg: 'rgba(59,130,246,0.12)', text: '#60a5fa', label: 'Scouting', icon: '🔎' },
  FIXING:            { bg: 'rgba(245,158,11,0.12)', text: '#fcd34d', label: 'Fixing', icon: '🛠️' },
  TESTING:           { bg: 'rgba(20,184,166,0.12)', text: '#2dd4bf', label: 'Testing', icon: '🧪' },
  AWAITING_APPROVAL: { bg: 'rgba(249,115,22,0.12)', text: '#fb923c', label: 'Awaiting Approval', icon: '👤' },
  APPROVED:          { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', label: 'Approved', icon: '✅' },
  RESOLVED:          { bg: 'rgba(34,197,94,0.12)', text: '#4ade80', label: 'Resolved', icon: '✅' },
  REJECTED:          { bg: 'rgba(239,68,68,0.12)', text: '#f87171', label: 'Rejected', icon: '❌' },
  FAILED:            { bg: 'rgba(239,68,68,0.12)', text: '#f87171', label: 'Failed', icon: '💥' },
  ESCALATED:         { bg: 'rgba(234,179,8,0.12)', text: '#facc15', label: 'Escalated', icon: '⚠️' },
};

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${Math.round(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`;
}

export function timeAgo(date: string | Date): string {
  const now = Date.now();
  const then = new Date(date).getTime();
  const diff = now - then;
  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.round(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.round(diff / 3600000)}h ago`;
  return `${Math.round(diff / 86400000)}d ago`;
}
