const { PrismaClient } = require('@prisma/client');
const { createLogger } = require('./logger');
const OpenAI = require('openai');

const log = createLogger('RAG');
const prisma = new PrismaClient();

let openai = null;
if (process.env.OPENAI_API_KEY) {
  openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
}

/**
 * Generates an embedding for the given text using OpenAI (if available).
 */
async function generateEmbedding(text) {
  if (!openai) return null;
  try {
    const response = await openai.embeddings.create({
      model: 'text-embedding-ada-002',
      input: text,
    });
    return response.data[0].embedding;
  } catch (err) {
    log.warn('Failed to generate embedding', { error: err.message });
    return null;
  }
}

/**
 * Searches the KnowledgeBase for relevant context (Data Dictionaries, Playbooks, or past Bug Fixes)
 * Uses pgvector cosine similarity if embeddings are available, otherwise falls back to basic ILIKE/trigram search.
 */
async function searchKnowledgeBase(query, knowledgeType = null, limit = 3) {
  log.info(`Searching KnowledgeBase`, { query: query.substring(0, 50), type: knowledgeType });
  const embedding = await generateEmbedding(query);

  let results = [];
  try {
    if (embedding) {
      // Vector Search
      const typeFilter = knowledgeType ? `AND type = '${knowledgeType}'` : '';
      
      results = await prisma.$queryRawUnsafe(`
        SELECT id, title, "bug_summary", "root_cause", type, metadata,
               1 - (embedding <=> ('[' || array_to_string($1::float[], ',') || ']')::vector) as similarity
        FROM knowledge_base
        WHERE 1=1 ${typeFilter}
        ORDER BY embedding <=> ('[' || array_to_string($1::float[], ',') || ']')::vector
        LIMIT $2
      `, embedding, limit);
      
      log.info(`Vector search returned ${results.length} results`);
    } else {
      // Fallback: Keyword search
      log.info(`No embeddings available, falling back to text search`);
      const searchTerms = query.split(' ').filter(w => w.length > 3).slice(0, 5);
      
      const whereClause = {
        OR: searchTerms.map(term => ({
          OR: [
            { title: { contains: term, mode: 'insensitive' } },
            { bugSummary: { contains: term, mode: 'insensitive' } }
          ]
        }))
      };
      
      if (knowledgeType) {
        whereClause.type = knowledgeType;
      }
      
      results = await prisma.knowledgeBase.findMany({
        where: searchTerms.length > 0 ? whereClause : (knowledgeType ? { type: knowledgeType } : {}),
        take: limit,
      });
      
      log.info(`Text search returned ${results.length} results`);
    }
    
    return results;
  } catch (err) {
    log.error('KnowledgeBase search failed', { error: err.message });
    return [];
  }
}

module.exports = { generateEmbedding, searchKnowledgeBase };
