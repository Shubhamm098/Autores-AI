/**
 * Notifier Agent
 * Sends email notifications for HITL approval requests
 * and resolution updates using Nodemailer.
 */
const nodemailer = require('nodemailer');

function createTransport() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendApprovalRequest({
  ticket,
  resolution,
  testResults,
  hitlApprovalId,
  dashboardUrl,
}) {
  const transporter = createTransport();
  const reviewerEmail = process.env.HITL_REVIEWER_EMAIL;
  const from = process.env.EMAIL_FROM || 'AutoRes AI <noreply@autores.ai>';
  const baseUrl = dashboardUrl || 'http://localhost:3000';

  const approveUrl = `${baseUrl}/tickets/${ticket.id}?action=approve&approvalId=${hitlApprovalId}`;
  const rejectUrl  = `${baseUrl}/tickets/${ticket.id}?action=reject&approvalId=${hitlApprovalId}`;
  const detailUrl  = `${baseUrl}/tickets/${ticket.id}`;

  const passedTests = testResults.tests?.filter((t) => t.status === 'passed').length || testResults.passed;
  const failedTests = testResults.tests?.filter((t) => t.status === 'failed').length || testResults.failed;
  const testStatusIcon = testResults.success ? '✅' : '⚠️';

  const severityColor = {
    CRITICAL: '#ef4444',
    HIGH:     '#f97316',
    MEDIUM:   '#eab308',
    LOW:      '#22c55e',
  }[ticket.severity] || '#64748b';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0f1117; color: #e2e8f0; margin: 0; padding: 0; }
    .container { max-width: 640px; margin: 0 auto; background: #1a1d2e; border-radius: 12px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px 40px; }
    .header h1 { margin: 0; font-size: 24px; color: white; }
    .header p { margin: 8px 0 0; color: rgba(255,255,255,0.8); font-size: 14px; }
    .body { padding: 32px 40px; }
    .badge { display: inline-block; padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: 600; background: ${severityColor}22; color: ${severityColor}; border: 1px solid ${severityColor}44; }
    .section { margin: 24px 0; padding: 20px; background: #252838; border-radius: 8px; border-left: 3px solid #6366f1; }
    .section h3 { margin: 0 0 12px; font-size: 14px; text-transform: uppercase; letter-spacing: 0.05em; color: #a5b4fc; }
    .section p { margin: 0; font-size: 14px; line-height: 1.6; color: #cbd5e1; }
    .test-results { display: flex; gap: 16px; margin-top: 8px; }
    .test-stat { padding: 8px 16px; border-radius: 6px; font-size: 13px; font-weight: 600; }
    .test-pass { background: #16a34a22; color: #4ade80; border: 1px solid #16a34a44; }
    .test-fail { background: #dc262622; color: #f87171; border: 1px solid #dc262644; }
    .actions { display: flex; gap: 12px; margin: 32px 0; }
    .btn { display: inline-block; padding: 14px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 15px; text-align: center; }
    .btn-approve { background: linear-gradient(135deg, #22c55e, #16a34a); color: white; }
    .btn-reject { background: #252838; color: #f87171; border: 1px solid #f8717144; }
    .btn-detail { background: #252838; color: #a5b4fc; border: 1px solid #6366f144; }
    .footer { padding: 24px 40px; border-top: 1px solid #252838; font-size: 12px; color: #475569; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🤖 AutoRes AI — Approval Required</h1>
      <p>A fix has been generated and tested. Your approval is needed before merging.</p>
    </div>
    <div class="body">
      <p><span class="badge">${ticket.severity}</span> &nbsp; <strong style="color:#e2e8f0">${ticket.title}</strong></p>

      <div class="section">
        <h3>📋 Ticket Details</h3>
        <p><strong>Service:</strong> ${ticket.service}<br>
           <strong>Reported:</strong> ${new Date(ticket.createdAt).toLocaleString()}</p>
        <p style="margin-top:8px">${ticket.description}</p>
      </div>

      <div class="section">
        <h3>🛠️ Proposed Fix</h3>
        <p>${resolution.fixDescription}</p>
        <p style="margin-top:8px"><strong>File:</strong> <code style="color:#a5b4fc">${resolution.affectedFile}</code></p>
      </div>

      <div class="section">
        <h3>${testStatusIcon} Test Results</h3>
        <div class="test-results">
          <div class="test-stat test-pass">✓ ${passedTests} Passed</div>
          ${failedTests > 0 ? `<div class="test-stat test-fail">✕ ${failedTests} Failed</div>` : ''}
        </div>
      </div>

      <div class="actions">
        <a href="${approveUrl}" class="btn btn-approve">✅ Approve & Merge</a>
        <a href="${rejectUrl}" class="btn btn-reject">❌ Reject</a>
        <a href="${detailUrl}" class="btn btn-detail">View Details →</a>
      </div>

      <p style="font-size:13px;color:#475569">You can also open the <a href="${detailUrl}" style="color:#a5b4fc">AutoRes Dashboard</a> to review the full code diff and test output before deciding.</p>
    </div>
    <div class="footer">
      AutoRes AI • Ticket ID: ${ticket.id} • Generated at ${new Date().toLocaleString()}
    </div>
  </div>
</body>
</html>`;

  await transporter.sendMail({
    from,
    to: reviewerEmail,
    subject: `[AutoRes AI] Approval Required: ${ticket.title} [${ticket.severity}]`,
    html,
  });

  console.log(`📧 Approval email sent to ${reviewerEmail}`);
}

async function sendResolutionNotice({ ticket, decision, reviewerEmail }) {
  const transporter = createTransport();
  const from = process.env.EMAIL_FROM || 'AutoRes AI <noreply@autores.ai>';
  const icon = decision === 'APPROVED' ? '✅' : '❌';
  const label = decision === 'APPROVED' ? 'Resolved' : 'Rejected';
  const color = decision === 'APPROVED' ? '#22c55e' : '#ef4444';

  await transporter.sendMail({
    from,
    to: reviewerEmail || process.env.HITL_REVIEWER_EMAIL,
    subject: `[AutoRes AI] ${icon} Ticket ${label}: ${ticket.title}`,
    html: `<div style="font-family:sans-serif;background:#0f1117;color:#e2e8f0;padding:32px;border-radius:12px">
      <h2 style="color:${color}">${icon} Ticket ${label}</h2>
      <p><strong>${ticket.title}</strong></p>
      <p>The ticket has been ${label.toLowerCase()} and AutoRes AI has updated the status accordingly.</p>
      <p style="color:#475569;font-size:12px">Ticket ID: ${ticket.id}</p>
    </div>`,
  });
}

module.exports = { sendApprovalRequest, sendResolutionNotice };
