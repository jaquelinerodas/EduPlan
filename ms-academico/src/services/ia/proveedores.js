/**
 * Adaptadores para la API de IA. Todos exponen la misma función:
 *   generarTexto({ sistema, mensaje }) -> Promise<string>
 * El proveedor se elige con AI_PROVIDER (gemini | claude | openai | simulado).
 */
const { config } = require('../../config/env');
const AppError = require('../../utils/AppError');

async function llamarApi(url, opciones) {
  let respuesta;
  try {
    respuesta = await fetch(url, { ...opciones, signal: AbortSignal.timeout(config.ia.timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new AppError('La IA tardó demasiado en responder', 504, 'IA_TIMEOUT');
    }
    throw new AppError('No se pudo conectar con la API de IA', 502, 'IA_NO_DISPONIBLE');
  }

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    console.error(`[ms-academico] IA respondió ${respuesta.status}:`, detalle.slice(0, 500));
    if (respuesta.status === 429) {
      throw new AppError('Se alcanzó el límite de uso de la IA, intenta en un momento', 429, 'IA_LIMITE');
    }
    if (respuesta.status === 404) {
      throw new AppError(`El modelo "${config.ia.modelo}" no existe, revisa AI_MODEL`, 502, 'IA_MODELO_INVALIDO');
    }
    if (respuesta.status === 401 || respuesta.status === 403) {
      throw new AppError('La API de IA rechazó la clave, revisa AI_API_KEY', 502, 'IA_CLAVE_INVALIDA');
    }
    throw new AppError('La API de IA devolvió un error', 502, 'IA_ERROR');
  }
  return respuesta.json();
}

const proveedores = {
  // https://ai.google.dev/api/generate-content
  async gemini({ sistema, mensaje }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ia.modelo}:generateContent`;
    const datos = await llamarApi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ia.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ text: mensaje }] }],
      }),
    });
    const partes = datos.candidates?.[0]?.content?.parts || [];
    return partes.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  },

  // https://docs.claude.com/en/api/messages
  async claude({ sistema, mensaje }) {
    const datos = await llamarApi('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ia.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ia.modelo,
        max_tokens: 2048,
        system: sistema,
        messages: [{ role: 'user', content: mensaje }],
      }),
    });
    return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  },

  // https://platform.openai.com/docs/api-reference/chat
  async openai({ sistema, mensaje }) {
    const datos = await llamarApi('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ia.apiKey}` },
      body: JSON.stringify({
        model: config.ia.modelo,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: mensaje },
        ],
      }),
    });
    return datos.choices?.[0]?.message?.content || '';
  },

  // Sin conexión: útil para pruebas y para demostrar sin clave de API
  async simulado({ mensaje }) {
    return `**Respuesta simulada (AI_PROVIDER=simulado)**\n\n${mensaje.slice(0, 600)}`;
  },
};

async function generarTexto(peticion) {
  const { proveedor, apiKey } = config.ia;
  if (proveedor !== 'simulado' && !apiKey) {
    throw new AppError('El asistente de IA no está configurado (falta AI_API_KEY)', 503, 'IA_NO_CONFIGURADA');
  }
  const texto = (await proveedores[proveedor](peticion)).trim();
  if (!texto) {
    throw new AppError('La IA no devolvió contenido, intenta de nuevo', 502, 'IA_RESPUESTA_VACIA');
  }
  return texto;
}

const nombreModelo = () => `${config.ia.proveedor}:${config.ia.modelo}`;

module.exports = { generarTexto, nombreModelo, proveedores };
