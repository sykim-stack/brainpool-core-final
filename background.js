// background.js — HajunCore 실제 연동 v1.1 (정리됨)
console.log("[HajunAI Background] v1.1 로드");

async function getCredentials() {
  return new Promise(resolve => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'geminiApiKey'], resolve);
  });
}

async function supabaseFetch(url, key, path, options = {}) {
  const res = await fetch(`${url}/rest/v1/${path}`, {
    ...options,
    headers: {
      'apikey': key,
      'Authorization': `Bearer ${key}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch(e) { return null; }
}

async function summarizeWithGemini(text, apiKey) {
  try {
    const prompt = `개발자 대화를 분석하여 JSON만 반환하세요. 마크다운 금지.
필드: last_task(80자 이내), summary(100자 이내 한 줄), next_action(구체적 다음 행동)

대화:
${text.substring(0, 3000)}`;

    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 2048,
            thinkingConfig: { thinkingBudget: 0 }
          }
        })
      }
    );

    const data = await res.json();
    if (data.error) return { _error: data.error.message };

    const raw = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleaned = raw.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) return { _error: 'JSON 파싱 실패' };
    return JSON.parse(match[0]);
  } catch(e) {
    return { _error: e.message };
  }
}

function buildPrompt({ lastTask, summary, nextAction }) {
  return `🦈 BRAINPOOL — 이어서 작업

[마지막 작업]
${lastTask || '없음'}

[현재 상황 요약]
${summary || '없음'}

[지금 바로 할 것]
${nextAction || '맥락 확인 후 이어서 진행'}

---
위 맥락을 기반으로 바로 이어서 작업해주세요.
별도 설명 없이 [지금 바로 할 것]부터 시작하세요.`;
}

async function handleSnapshot(data) {
  const traceId = 'tr-' + Date.now();

  const { supabaseUrl, supabaseKey, geminiApiKey } = await getCredentials();

  if (!supabaseUrl || !supabaseKey) {
    return { success: false, error: 'Supabase 설정 필요', traceId };
  }

  const text = data?.text || '';
  if (!text) {
    return { success: false, error: '대화 내용 없음', traceId };
  }

  let lastTask = '작업 진행 중';
  let summary = '요약 없음';
  let nextAction = '';

  if (geminiApiKey) {
    const geminiResult = await summarizeWithGemini(text, geminiApiKey);
    if (!geminiResult._error) {
      lastTask = geminiResult.last_task || lastTask;
      summary = geminiResult.summary || summary;
      nextAction = geminiResult.next_action || nextAction;
    } else {
      console.warn('[Snapshot] Gemini 실패:', geminiResult._error);
    }
  }

  const contextPayload = {
    project_id: 'aaaaaaaa-0000-0000-0000-000000000001',
    last_task: lastTask,
    summary: summary,
    next_action: nextAction,
    updated_at: new Date().toISOString()
  };

  const saved = await supabaseFetch(
    supabaseUrl, supabaseKey,
    'contexts?on_conflict=project_id',
    {
      method: 'POST',
      headers: {
        'Prefer': 'resolution=merge-duplicates,return=representation',
        'Content-Profile': 'public',
        'Accept-Profile': 'public'
      },
      body: JSON.stringify(contextPayload)
    }
  );

  if (!saved) {
    console.warn('[Snapshot] Supabase 저장 실패');
  }

  const prompt = buildPrompt({ lastTask, summary, nextAction });

  console.log(`[Snapshot] ✅ 완료 traceId: ${traceId}`);
  return { success: true, summary, prompt, lastTask, nextAction, traceId };
}

async function getLatestContext() {
  const { supabaseUrl, supabaseKey } = await getCredentials();
  if (!supabaseUrl || !supabaseKey) return { _error: '설정 필요' };

  const data = await supabaseFetch(
    supabaseUrl, supabaseKey,
    'contexts?order=updated_at.desc&limit=1',
    { headers: { 'Accept-Profile': 'public' } }
  );

  const ctx = data?.[0];
  if (!ctx) return { _error: '저장된 컨텍스트 없음' };

  return {
    success: true,
    context: ctx,
    prompt: buildPrompt({
      lastTask: ctx.last_task,
      summary: ctx.summary,
      nextAction: ctx.next_action
    })
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'MANUAL_SNAPSHOT') {
    handleSnapshot(msg.data)
      .then(sendResponse)
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'INJECT_CONTENT_SCRIPT') {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ['content.js']
    }).then(() => sendResponse({ success: true }))
      .catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'GET_LATEST_CONTEXT') {
    getLatestContext()
      .then(sendResponse)
      .catch(e => sendResponse({ _error: e.message }));
    return true;
  }

  sendResponse({ error: 'Unknown type' });
  return false;
});

console.log("[Background] ✅ v1.1 로드 완료");