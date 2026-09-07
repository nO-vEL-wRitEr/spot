const GEMINI_MODELS = [
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
  'gemini-3.5-flash-lite'
];

function json(res, status, body) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
}

function buildPrompt(summary) {
  return `당신은 SPOT이라는 소비관리 앱의 AI 소비 코치입니다.
아래 데이터는 사용자의 실제 지출 내역을 개인정보를 최소화해 집계한 값입니다.

${JSON.stringify(summary, null, 2)}

한국어로 다음 JSON만 반환하세요. 마크다운 코드블록은 쓰지 마세요.
{
  "headline": "한 문장의 핵심 소비 인사이트 (35자 이내)",
  "detail": "그 근거를 실제 숫자를 사용해 설명 (60자 이내)",
  "tip": "강요하지 않는 현실적인 절약 또는 예산 관리 팁 (55자 이내)"
}

규칙:
- 데이터에 없는 사실은 만들지 마세요.
- 지출이 적거나 비교 데이터가 부족하면 부족하다고 명확히 말하세요.
- 사용자를 비난하거나 불안하게 만들지 마세요.
- 금액과 퍼센트는 제공된 데이터에서만 사용하세요.`;
}

async function callGemini(apiKey, model, summary) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: buildPrompt(summary) }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        maxOutputTokens: 500
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('') || '';
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');

  let parsed;
  try {
    parsed = JSON.parse(text.replace(/^```json\s*|\s*```$/g, '').trim());
  } catch {
    throw new Error('Gemini 응답을 JSON으로 해석하지 못했습니다.');
  }

  return {
    headline: String(parsed.headline || '').slice(0, 120),
    detail: String(parsed.detail || '').slice(0, 180),
    tip: String(parsed.tip || '').slice(0, 180)
  };
}

module.exports = async function handler(req, res) {
  if (req.method === 'GET') {
    return json(res, 200, { models: GEMINI_MODELS, defaultModel: 'gemini-3.8-flash' });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 503, {
      error: 'GEMINI_API_KEY가 설정되지 않았습니다.',
      code: 'MISSING_API_KEY'
    });
  }

  const body = typeof req.body === 'string' ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })() : (req.body || {});
  const summary = body.summary;
  const requestedModel = GEMINI_MODELS.includes(body.model) ? body.model : 'gemini-3.8-flash';

  if (!summary || typeof summary !== 'object') {
    return json(res, 400, { error: 'summary가 필요합니다.' });
  }

  const fallbackOrder = [requestedModel, ...GEMINI_MODELS.filter(m => m !== requestedModel)];
  const errors = [];

  for (const model of fallbackOrder) {
    try {
      const insight = await callGemini(apiKey, model, summary);
      return json(res, 200, { model, insight });
    } catch (error) {
      errors.push({ model, message: error.message });
      if (![404, 429, 503].includes(error.status)) break;
    }
  }

  return json(res, 502, {
    error: '사용 가능한 Gemini 모델로 인사이트를 생성하지 못했습니다.',
    attempts: errors
  });
};
