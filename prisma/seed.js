const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const demoTickets = [
  {
    title: 'E-Commerce: Race condition in checkout allows negative stock',
    description: 'When two users checkout simultaneously for the same item with 1 stock remaining, both requests pass the inventory check and deduct stock, resulting in -1 stock for the product.',
    stackTrace: 'Error: Expect stock to be >= 0 but got -1\n    at processCheckout (src/routes/cart.js:45)',
    severity: 'CRITICAL',
    service: 'cart-service',
    affectedUrl: 'POST /api/cart/checkout',
    reportedBy: 'warehouse-system',
  },
  {
    title: 'E-Commerce: Rounding error on discount calculation',
    description: 'The discount endpoint uses Math.floor when applying a percentage discount, which drops decimal precision incorrectly and causes accounting discrepancies.',
    stackTrace: 'AssertionError: expected 9.34 to be close to 9.3415\n    at calculateDiscount (src/routes/cart.js:62)',
    severity: 'MEDIUM',
    service: 'cart-service',
    affectedUrl: 'POST /api/cart/discount',
    reportedBy: 'finance-team',
  }
];

async function main() {
  console.log('🌱 Seeding database...');

  await prisma.ticket.deleteMany({});
  console.log('🗑️ Wiped old tickets');

  for (const ticket of demoTickets) {
    await prisma.ticket.create({ data: ticket });
    console.log(`  ✅ Created ticket: ${ticket.title}`);
  }

  // Seed Playbook for Metadata Context
  const playbook = await prisma.knowledgeBase.findFirst({ where: { title: 'Checkout Configuration Playbook' } });
  if (!playbook) {
    await prisma.knowledgeBase.create({
      data: {
        ticketId: 'playbook-001',
        title: 'Checkout Configuration Playbook',
        bugSummary: 'Checkout failures returning 403 Forbidden due to tenant metadata.',
        rootCause: 'Tenant configuration was misconfigured in the database.',
        fixDescription: 'The `allow_checkout` feature flag in `tenant_configs` table must be set to true for the specific tenant, or the application code must bypass the flag for admin roles.',
        affectedFile: 'N/A',
        diffPatch: 'N/A',
        bugType: 'MetadataError',
        type: 'PLAYBOOK',
        metadata: { rule: "If checkout returns 403, check tenant_configs JSONB features and set allow_checkout to true." }
      }
    });
    console.log(`  ✅ Created Playbook: Checkout Configuration Playbook`);
  }

  console.log('\n✨ Seed complete! Created', demoTickets.length, 'demo tickets.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
