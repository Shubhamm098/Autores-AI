/**
 * Groq Client — Fast inference via groq.com
 * Groq's API is OpenAI-compatible, so we use the openai SDK
 * pointed at https://api.groq.com/openai/v1
 */
const OpenAI = require('openai');
const { createLogger } = require('./logger');
const log = createLogger('GroqClient');

const groq = new OpenAI({
  apiKey: process.env.GROQ_API_KEY,
  baseURL: 'https://api.groq.com/openai/v1',
});

const MODEL = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';

/**
 * Chat completion with Groq (ultra-fast inference)
 * @param {Array} messages - OpenAI-style message array
 * @param {Object} options  - Additional options
 * @returns {string}        - Model response text
 */
async function chat(messages, options = {}) {
  let model = options.model || MODEL;
  const timer = log.time(`LLM call (${model})`);
  log.debug(`Sending request to Groq`, { model, temperature: options.temperature ?? 0.2, maxTokens: options.maxTokens ?? 4096, response_format: options.response_format || 'text' });

  // List of fallback models if we hit a 429
  const fallbacks = [
    'mixtral-8x7b-32768',
    'llama-3.1-8b-instant',
    'gemma2-9b-it'
  ];

  for (let attempt = 0; attempt <= fallbacks.length; attempt++) {
    try {
      const reqOpts = {
        model,
        messages,
        temperature: options.temperature ?? 0.2,
        max_tokens: options.maxTokens ?? 4096,
      };
      if (options.response_format) {
        reqOpts.response_format = options.response_format;
      }
  
      const completion = await groq.chat.completions.create(reqOpts);
      const content = completion.choices[0]?.message?.content || '';
      
      timer.end(`tokens: ${completion.usage?.total_tokens || 0} (prompt: ${completion.usage?.prompt_tokens || 0}, completion: ${completion.usage?.completion_tokens || 0})`);
      return content;
    } catch (err) {
      if ((err.status === 429 || err.status === 400) && attempt < fallbacks.length) {
        log.warn(`Model ${model} failed (${err.status}), falling back to ${fallbacks[attempt]}...`);
        model = fallbacks[attempt];
        continue;
      }
      timer.end('FAILED');
      log.error(`Groq API call failed`, { error: err.message, status: err.status });
      throw err;
    }
  }
}

/**
 * Embeddings — Groq doesn't provide embedding models,
 * so we use a simple TF-IDF-inspired numeric hash for
 * the knowledge base similarity search. In production,
 * swap this for OpenAI/Cohere embeddings.
 *
 * @param {string} text
 * @returns {number[]} 1536-dim vector
 */
function embed(text) {
  const vec = new Array(1536).fill(0);
  const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
  for (const word of words) {
    let hash = 5381;
    for (let i = 0; i < word.length; i++) {
      hash = (hash * 33) ^ word.charCodeAt(i);
    }
    const idx = Math.abs(hash) % 1536;
    vec[idx] += 1;
  }
  // L2-normalise
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map((v) => v / norm);
}

module.exports = { chat, embed, MODEL };
