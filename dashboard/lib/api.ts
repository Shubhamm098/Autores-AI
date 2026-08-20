const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchTickets() {
  const res = await fetch(`${API_URL}/api/tickets`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch tickets');
  return res.json();
}

export async function fetchTicket(id: string) {
  const res = await fetch(`${API_URL}/api/tickets/${id}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch ticket');
  return res.json();
}

export async function createTicket(data: {
  title: string;
  description: string;
  stackTrace?: string;
  severity: string;
  service: string;
  affectedUrl?: string;
  reportedBy?: string;
}) {
  const res = await fetch(`${API_URL}/api/tickets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to create ticket');
  return res.json();
}

export async function submitDecision(approvalId: string, data: {
  decision: string;
  reviewerComment?: string;
  reviewerEmail?: string;
}) {
  const res = await fetch(`${API_URL}/api/approvals/${approvalId}/decide`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error('Failed to submit decision');
  return res.json();
}

export async function fetchKnowledge() {
  const res = await fetch(`${API_URL}/api/knowledge`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch knowledge base');
  return res.json();
}

export async function fetchMetrics() {
  const res = await fetch(`${API_URL}/api/metrics`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to fetch metrics');
  return res.json();
}
