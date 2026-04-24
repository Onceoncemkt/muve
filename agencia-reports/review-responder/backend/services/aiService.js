const Anthropic = require('@anthropic-ai/sdk');
const { getDb } = require('../database');

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const STAR_LABELS = { 1: '1 estrella (muy negativa)', 2: '2 estrellas (negativa)', 3: '3 estrellas (neutral)', 4: '4 estrellas (positiva)', 5: '5 estrellas (excelente)' };

async function generateResponse(reviewId) {
  const db = getDb();

  const review = db.prepare(`
    SELECT r.*, c.name AS client_name, c.business_type, c.brand_personality, c.context
    FROM reviews r
    JOIN clients c ON c.id = r.client_id
    WHERE r.id = ?
  `).get(reviewId);

  if (!review) throw new Error(`Review ${reviewId} not found`);

  const platformLabel = review.platform === 'google' ? 'reseña de Google' :
    review.platform === 'facebook' ? 'comentario de Facebook' : 'comentario de Instagram';

  const system = `Eres el gestor de reputación online de un negocio de tipo "${review.business_type}" llamado "${review.client_name}".

Personalidad de marca: ${review.brand_personality}

Contexto adicional del negocio: ${review.context || 'Sin contexto adicional.'}

Tu tarea es redactar una respuesta profesional y alineada con la marca a la siguiente ${platformLabel}.

REGLAS ESTRICTAS:
- Adapta el tono EXACTAMENTE a la personalidad de marca descrita
- Sé conciso: entre 2 y 4 oraciones máximo
- Si la reseña es negativa (1-2 estrellas): reconoce el problema específico, ofrece disculpas sinceras y proporciona una vía de contacto para resolverlo
- Si la reseña es positiva (4-5 estrellas): agradece de forma cálida y refuerza aquello que el cliente valoró
- Para comentarios neutros o sin puntuación: responde de forma natural y cercana
- NUNCA inventes datos del negocio que no estén en el contexto
- Responde SIEMPRE en el mismo idioma en que escribió el cliente
- NO uses saludos genéricos como "Estimado cliente"
- NO repitas el nombre del cliente si no lo conoces
- Devuelve ÚNICAMENTE el texto de la respuesta, sin explicaciones adicionales`;

  let userContent = review.content ? `"${review.content}"` : '(Sin texto — solo puntuación)';
  if (review.star_rating) {
    userContent = `Puntuación: ${STAR_LABELS[review.star_rating] || review.star_rating + ' estrellas'}\n\n${userContent}`;
  }

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 400,
    system,
    messages: [{ role: 'user', content: userContent }]
  });

  const suggestion = message.content[0].text.trim();

  db.prepare('UPDATE reviews SET ai_suggestion = ? WHERE id = ?').run(suggestion, reviewId);

  return suggestion;
}

module.exports = { generateResponse };
