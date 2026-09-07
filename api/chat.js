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

function buildSystemPrompt(summary) {
  return `당신은 SPOT 소비관리 앱의 AI 소비 코치입니다.
사용자가 입력한 실제 지출 집계 데이터를 바탕으로만 답하세요.
데이터에 없는 결제내역이나 금액은 추측하지 마세요.
답변은 한국어로, 모바일 채팅에 맞게 짧고 명확하게 작성하세요.
가능하면 실제 금액, 비율, 카테고리를 근거로 답하세요.
재정적 결정을 강요하지 말고 소비 습관을 이해하도록 도와주세요.

현재 지출 집계:
${JSON.stringify(summary, null, 2)}`;
}

async function callGemini(apiKey, model, summary, messages) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

  const recent = Array.isArray(messages) ? messages.slice(-10) : [];
  const contents = [
    { role: 'user', parts: [{ text: buildSystemPrompt(summary) }] },
    { role: 'model', parts: [{ text: '알겠습니다. 제공된 SPOT 지출 데이터만 근거로 답하겠습니다.' }] },
    ...recent.map(m => ({
      role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
      parts: [{ text: String(m.text || '').slice(0, 2000) }]
    }))
  ];

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      generationConfig: {
        temperature: 0.45,
        maxOutputTokens: 700
      }
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(data?.error?.message || `Gemini API HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }

  const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim() || '';
  if (!text) throw new Error('Gemini 응답이 비어 있습니다.');
  return text.slice(0, 4000);
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 503, { error: 'GEMINI_API_KEY가 설정되지 않았습니다.', code: 'MISSING_API_KEY' });
  }

  const body = typeof req.body === 'string'
    ? (() => { try { return JSON.parse(req.body); } catch { return {}; } })()
    : (req.body || {});

  const summary = body.summary;
  const messages = Array.isArray(body.messages) ? body.messages : [];
  const requestedModel = GEMINI_MODELS.includes(body.model) ? body.model : 'gemini-3.8-flash';

  if (!summary || typeof summary !== 'object') return json(res, 400, { error: 'summary가 필요합니다.' });
  if (!messages.length || !String(messages[messages.length - 1]?.text || '').trim()) {
    return json(res, 400, { error: '메시지가 필요합니다.' });
  }

  const fallbackOrder = [requestedModel, ...GEMINI_MODELS.filter(m => m !== requestedModel)];
  const attempts = [];

  for (const model of fallbackOrder) {
    try {
      const reply = await callGemini(apiKey, model, summary, messages);
      return json(res, 200, { model, reply });
    } catch (error) {
      attempts.push({ model, message: error.message });
      if (![404, 429, 503].includes(error.status)) break;
    }
  }

  return json(res, 502, { error: 'AI 소비 코치가 응답하지 못했습니다.', attempts });
};
