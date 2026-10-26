/**
 * Adaptadores para la API de IA. Todos exponen las mismas funciones:
 *   generarTexto({ sistema, mensaje })              -> texto (Markdown)
 *   generarJson({ sistema, mensaje, simulado })     -> objeto JSON
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
      throw new AppError('La IA tardó demasiado en responder. Intenta con menos contenido.', 504, 'IA_TIMEOUT');
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
  async gemini({ sistema, mensaje, json }) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.ia.modelo}:generateContent`;
    const datos = await llamarApi(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': config.ia.apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: sistema }] },
        contents: [{ role: 'user', parts: [{ text: mensaje }] }],
        ...(json ? { generationConfig: { responseMimeType: 'application/json' } } : {}),
      }),
    });
    const partes = datos.candidates?.[0]?.content?.parts || [];
    return partes.filter((p) => p.text && !p.thought).map((p) => p.text).join('');
  },

  // https://docs.claude.com/en/api/messages
  async claude({ sistema, mensaje, json }) {
    const datos = await llamarApi('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': config.ia.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: config.ia.modelo,
        max_tokens: json ? 8192 : 2048,
        system: sistema,
        messages: [{ role: 'user', content: mensaje }],
      }),
    });
    return (datos.content || []).filter((b) => b.type === 'text').map((b) => b.text).join('');
  },

  // https://platform.openai.com/docs/api-reference/chat
  async openai({ sistema, mensaje, json }) {
    const datos = await llamarApi('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.ia.apiKey}` },
      body: JSON.stringify({
        model: config.ia.modelo,
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: mensaje },
        ],
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
    return datos.choices?.[0]?.message?.content || '';
  },

  // Sin conexión: útil para pruebas y para demostrar sin clave de API
  async simulado({ mensaje }) {
    return `**Respuesta simulada (AI_PROVIDER=simulado)**\n\n${mensaje.slice(0, 600)}`;
  },
};

function verificarConfiguracion() {
  const { proveedor, apiKey } = config.ia;
  if (proveedor !== 'simulado' && !apiKey) {
    throw new AppError('El asistente de IA no está configurado (falta AI_API_KEY)', 503, 'IA_NO_CONFIGURADA');
  }
}

async function generarTexto(peticion) {
  verificarConfiguracion();
  const texto = (await proveedores[config.ia.proveedor](peticion)).trim();
  if (!texto) {
    throw new AppError('La IA no devolvió contenido, intenta de nuevo', 502, 'IA_RESPUESTA_VACIA');
  }
  return texto;
}

/** Extrae el objeto JSON aunque el modelo lo envuelva en ```json ... ``` o agregue texto. */
function interpretarJson(texto) {
  const limpio = String(texto || '').replace(/```(?:json)?/gi, '').trim();
  const inicio = limpio.indexOf('{');
  const fin = limpio.lastIndexOf('}');
  if (inicio === -1 || fin <= inicio) return null;
  try {
    return JSON.parse(limpio.slice(inicio, fin + 1));
  } catch {
    return null;
  }
}

/**
 * Pide al modelo una respuesta en JSON.
 * "simulado" es una función que genera datos de ejemplo cuando AI_PROVIDER=simulado.
 */
async function generarJson({ sistema, mensaje, simulado }) {
  verificarConfiguracion();
  if (config.ia.proveedor === 'simulado') {
    if (!simulado) throw new AppError('Función no disponible en modo simulado', 501, 'IA_SIMULADO');
    return simulado();
  }

  const instrucciones = `${sistema}\n\nResponde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código.`;
  for (let intento = 1; intento <= 2; intento++) {
    const texto = await proveedores[config.ia.proveedor]({ sistema: instrucciones, mensaje, json: true });
    const datos = interpretarJson(texto);
    if (datos) return datos;
    console.error(`[ms-academico] La IA no devolvió JSON válido (intento ${intento}):`, String(texto).slice(0, 300));
  }
  throw new AppError('La IA devolvió una respuesta con formato inválido, intenta de nuevo', 502, 'IA_RESPUESTA_INVALIDA');
}

const nombreModelo = () => `${config.ia.proveedor}:${config.ia.modelo}`;

module.exports = { generarTexto, generarJson, interpretarJson, nombreModelo, proveedores };
