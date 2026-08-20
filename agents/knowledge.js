/**
 * Knowledge Agent
 * Stores resolved bugs as vector embeddings in PostgreSQL (pgvector)
 * and retrieves similar past resolutions for auto-fix.
 */
const { PrismaClient } = require('@prisma/client');
const { embed } = require('./groq-client');

const prisma = new PrismaClient();

async function storeSolution(ticket, analysisResult, resolution) {
  const textToEmbed = [
    ticket.title,
    ticket.description,
    analysisResult.bugType,
    analysisResult.rootCause,
    resolution.fixDescription,
  ].join(' ');

  const embedding = await embed(textToEmbed);

  // Store using raw SQL since Prisma doesn't support pgvector natively
  await prisma.$executeRaw`
    INSERT INTO knowledge_base (
      id, ticket_id, title, bug_summary, root_cause, fix_description,
      affected_file, diff_patch, tags, bug_type, embedding, created_at
    ) VALUES (
      gen_random_uuid(),
      ${ticket.id},
      ${ticket.title},
      ${ticket.description},
      ${analysisResult.rootCause},
      ${resolution.fixDescription},
      ${resolution.affectedFile},
      ${resolution.diffPatch},
      ${analysisResult.keywords},
      ${analysisResult.bugType},
      ${JSON.stringify(embedding)}::vector,
      NOW()
    )
  `;

  console.log(`📚 Stored solution for ticket "${ticket.title}" in knowledge base`);
}

async function findSimilar(ticket, threshold = 0.85) {
  const textToEmbed = `${ticket.title} ${ticket.description}`;
  const embedding = await embed(textToEmbed);

  const results = await prisma.$queryRaw`
    SELECT
      id, title, bug_summary, root_cause, fix_description,
      affected_file, diff_patch, tags, bug_type, times_referenced,
      1 - (embedding <=> ${JSON.stringify(embedding)}::vector) AS similarity
    FROM knowledge_base
    WHERE 1 - (embedding <=> ${JSON.stringify(embedding)}::vector) > ${threshold}
    ORDER BY similarity DESC
    LIMIT 3
  `;

  if (results.length > 0) {
    // Increment reference count
    await prisma.$executeRaw`
      UPDATE knowledge_base
      SET times_referenced = times_referenced + 1
      WHERE id = ${results[0].id}
    `;
  }

  return results;
}

async function listAll() {
  return prisma.$queryRaw`
    SELECT id, title, bug_summary, root_cause, fix_description,
           affected_file, bug_type, tags, times_referenced, created_at
    FROM knowledge_base
    ORDER BY created_at DESC
  `;
}

module.exports = { storeSolution, findSimilar, listAll };

