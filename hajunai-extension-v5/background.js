// background.js v5.2.4 — Action Engine 위치 수정

console.log('[HajunAI Background] v5.2.4 로드 시작');

const SUPABASE_URL = 'https://grlfocvlfatuvphkyivd.supabase.co';
const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

// ==================== 메시지 핸들러 ====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`[Background] ✅ 메시지 수신: ${msg.type}`);
  
  if (msg.type === 'CONTENT_SCRIPT_READY') {
    console.log(`[Background] content.js 준비 완료: ${msg.host}`);
    sendResponse({ status: 'ok' });
    return true;
  }
  
  if (msg.type === 'INJECT_CONTENT_SCRIPT') {
    console.log('[Background] content.js 주입 요청, tabId:', msg.tabId);
    
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ['content.js']
    })
    .then(() => {
      console.log('[Background] ✅ content.js 주입 성공');
      sendResponse({ success: true });
    })
    .catch((err) => {
      console.error('[Background] ❌ content.js 주입 실패:', err);
      sendResponse({ success: false, error: err.message });
    });
    
    return true;
  }
  
  if (msg.type === 'GET_STATUS') {
    getStatus()
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ aiTabs: [], error: err.message }));
    return true;
  }
  
  if (msg.type === 'MANUAL_SNAPSHOT') {
    handleManualSnapshot(msg.data)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  
  sendResponse({ error: 'Unknown type: ' + msg.type });
  return false;
});

console.log('[Background] 메시지 리스너 등록 완료');

// Keep-Alive
function startKeepAlive() {
  setInterval(() => {
    console.log('[Background] ♻️ Keep-Alive ping');
  }, 25000);
}
startKeepAlive();

console.log('[HajunAI Background] v5.2.4 완전히 로드됨 ✅');

// ==================== getStatus ====================
async function getStatus() {
  try {
    const tabs = await chrome.tabs.query({});
    const aiSites = ['claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai'];
    
    const aiTabs = tabs.filter(tab => {
      if (!tab.url) return false;
      return aiSites.some(site => tab.url.includes(site));
    });

    return {
      aiTabs: aiTabs.map(t => ({
        id: t.id,
        title: t.title || 'Untitled',
        url: t.url,
        ai: detectAI(t.url)
      })),
      timestamp: new Date().toISOString()
    };
  } catch (e) {
    return { aiTabs: [], error: e.message };
  }
}

function detectAI(url) {
  if (!url) return 'Unknown';
  if (url.includes('claude.ai')) return 'Claude';
  if (url.includes('chatgpt.com')) return 'ChatGPT';
  if (url.includes('gemini.google.com')) return 'Gemini';
  if (url.includes('perplexity.ai')) return 'Perplexity';
  return 'AI';
}

// ==================== ExtractLayer ====================
function ExtractLayer(input) {
  const ctx = { rawConversation: null, _error: null };
  try {
    ctx.rawConversation = {
      source: input.ai || 'manual',
      title: input.title || 'Untitled',
      rawText: input.text || '',
      timestamp: input.extractedAt || new Date().toISOString(),
      url: input.url || null
    };
  } catch (e) {
    ctx._error = e.message;
  }
  return ctx;
}

// ==================== Action Engine (Phase0) ====================
async function actionEngine(currentState, structured, rawTitle) {
  const ctx = { nextAction: null, reasoning: null, _error: null };
  
  try {
    const lastTask = currentState?.last_task || '초기 상태';
    const currentProblems = currentState?.current_problems || '없음';
    const lastSummary = structured?.summary || rawTitle || '대화 저장됨';
    
    let nextAction = '';
    let reasoning = '';
    
    if (currentProblems && currentProblems !== '없음' && currentProblems !== 'null') {
      nextAction = `🔧 문제 해결: ${currentProblems.substring(0, 50)}`;
      reasoning = '현재 문제가 감지되어 해결이 우선입니다.';
    } else if (lastTask && lastTask !== '초기 상태') {
      nextAction = `📌 이어서 작업: ${lastTask}`;
      reasoning = '진행 중인 작업을 계속합니다.';
    } else {
      const lowerSummary = lastSummary.toLowerCase();
      if (lowerSummary.includes('버그') || lowerSummary.includes('에러') || lowerSummary.includes('오류')) {
        nextAction = '🐛 버그 수정 및 디버깅';
        reasoning = '대화에서 버그/에러가 감지되었습니다.';
      } else if (lowerSummary.includes('테스트') || lowerSummary.includes('검증')) {
        nextAction = '✅ 테스트 및 검증 진행';
        reasoning = '테스트 관련 대화가 감지되었습니다.';
      } else if (lowerSummary.includes('개발') || lowerSummary.includes('구현') || lowerSummary.includes('코드')) {
        nextAction = '💻 코드 개발 계속';
        reasoning = '개발 관련 대화가 감지되었습니다.';
      } else if (lowerSummary.includes('문서') || lowerSummary.includes('정리')) {
        nextAction = '📝 문서 정리 및 업데이트';
        reasoning = '문서화 관련 대화가 감지되었습니다.';
      } else {
        nextAction = '🤔 다음 단계 분석 중... (Claude와 대화를 이어가보세요)';
        reasoning = '명확한 작업 방향이 감지되지 않았습니다.';
      }
    }
    
    ctx.nextAction = nextAction;
    ctx.reasoning = reasoning;
    
    console.log('[ActionEngine] 🎯 다음 행동:', nextAction);
    console.log('[ActionEngine] 💡 이유:', reasoning);
    
    return ctx;
  } catch (e) {
    ctx._error = e.message;
    console.error('[ActionEngine] ❌', e);
    return ctx;
  }
}

// ==================== Gemini Action Engine ====================
async function analyzeWithGemini(apiKey, text, title) {

  const ctx = {
    result: null,
    _error: null
  };

  try {

    const model = 'gemini-2.5-flash';

    // 긴 텍스트 압축
    const shortText =
      text.length > 3000
        ? text.slice(0, 1500) +
          '\n...[중략]...\n' +
          text.slice(-1500)
        : text;

const prompt = `
너는 프로젝트 상태 분석기다.

반드시 아래 형식만 출력한다.

STATE: 20~60자 상태 요약
BLOCKER: 막힌 이유 (없으면 없음)
NEXT: 반드시 동사 포함 행동 1개
RISK: 위험 요소 (없으면 없음)
HEALTH: 0~100 숫자

규칙:
- NEXT는 "교체 진행", "버그 수정", "테스트 실행"처럼 행동 형태여야 한다
- 숫자만 출력 금지
- 설명 금지
- 긴 문장 금지

대화:
${shortText}
`;

    console.log('[Gemini] Action Engine 시작');

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.1,
            maxOutputTokens: 1024
          }
        })
      }
    );

    if (!response.ok) {

      const errText = await response.text();

      throw new Error(
        `Gemini API 오류 (${response.status}): ${errText}`
      );
    }

    const data = await response.json();

    console.log('[Gemini Full Response]');
    console.log(data);

    // 응답 추출
    let rawText = '';

    const candidate =
      data &&
      data.candidates &&
      data.candidates[0]
        ? data.candidates[0]
        : null;

    if (
      candidate &&
      candidate.content &&
      candidate.content.parts
    ) {

      rawText = candidate.content.parts
        .map(function (p) {
          return p.text || '';
        })
        .join('\n');
    }

    console.log('[Gemini Raw]');
    console.log(rawText);

    // 빈 응답 대응
    if (!rawText || rawText.trim() === '') {

      ctx.result = {
        current_state: '응답 없음',
        blocker: 'Gemini 빈 응답',
        next_action: '프롬프트 축소',
        risk: '컨텍스트 손실',
        last_task: title || '작업중',
        health_score: 40,
        analyzed_at: new Date().toISOString()
      };

      return ctx;
    }

    // regex 추출
    const state =
      rawText.match(/STATE:\s*(.*)/i)?.[1]?.trim()
      || '분석중';

    const blocker =
      rawText.match(/BLOCKER:\s*(.*)/i)?.[1]?.trim()
      || '없음';

    const nextAction =
      rawText.match(/NEXT:\s*(.*)/i)?.[1]?.trim()
      || '다음 작업 확인';

    const risk =
      rawText.match(/RISK:\s*(.*)/i)?.[1]?.trim()
      || '없음';

    let health =
      parseInt(
        rawText.match(/HEALTH:\s*(\d+)/i)?.[1]
      );

    if (isNaN(health)) {
      health = 80;
    }

    ctx.result = {

      current_state:
        state.slice(0, 200),
    
      blocker:
        blocker.slice(0, 120),
    
      next_action:
        nextAction.slice(0, 120),
    
      risk:
        risk.slice(0, 120),
    
      last_task:
        title || '작업중',
    
      health_score:
        Math.max(0, Math.min(100, health)),
    
      analyzed_at:
        new Date().toISOString()
    };

    console.log('[Gemini] ✅ Action Engine 완료');
    console.log(ctx.result);

    return ctx;

  } catch (e) {

    console.error('[Gemini] ❌ 전체 실패');
    console.error(e);

    ctx._error = e.message;

    ctx.result = {
      current_state: '분석 실패',
      blocker: e.message,
      next_action: 'Gemini API 상태 확인',
      risk: '컨텍스트 손실 가능성',
      last_task: title || '작업중',
      health_score: 35,
      analyzed_at: new Date().toISOString()
    };

    return ctx;
  }
}

// ==================== Notion 연동 ====================
async function saveToNotion(title, ai, summary, url, apiKey, databaseId) {
  const ctx = { success: false, _error: null };
  
  try {
    console.log('[Notion] 저장 시도:', title);
    
    let aiValue = 'AI';
    if (ai === 'Claude') aiValue = 'Claude';
    else if (ai === 'ChatGPT') aiValue = 'ChatGPT';
    else if (ai === 'Gemini') aiValue = 'Gemini';
    else if (ai === 'Perplexity') aiValue = 'Perplexity';
    
    const response = await fetch('https://api.notion.com/v1/pages', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + apiKey,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28'
      },
      body: JSON.stringify({
        parent: { database_id: databaseId },
        properties: {
          '제목': { title: [{ text: { content: title.substring(0, 100) } }] },
          'AI': { select: { name: aiValue } },
          '요약': { rich_text: [{ text: { content: summary || '분석 없음' } }] },
          '날짜': { date: { start: new Date().toISOString() } },
          '원본 링크': { url: url || null }
        }
      })
    });
    
    if (!response.ok) {
      const err = await response.text();
      throw new Error('Notion 저장 실패 (' + response.status + '): ' + err);
    }
    
    const data = await response.json();
    ctx.success = true;
    console.log('[Notion] ✅ 저장 성공, 페이지 ID:', data.id);
  } catch (e) {
    ctx._error = e.message;
    console.error('[Notion] ❌', ctx._error);
  }
  
  return ctx;
}

// ==================== SnapshotLayer ====================
async function SnapshotLayer(ctx) {
  const result = { success: false, _error: null, summary: null };

  try {
    const storage = await chrome.storage.local.get(['supabaseKey', 'geminiApiKey', 'notionApiKey', 'notionDbId']);
    const supabaseKey = storage.supabaseKey;
    const geminiApiKey = storage.geminiApiKey;
    const notionApiKey = storage.notionApiKey;
    const notionDbId = storage.notionDbId;
    
    if (!supabaseKey) {
      throw new Error('Supabase Key가 설정되지 않았습니다.');
    }

    const raw = ctx.rawConversation;
    if (!raw || !raw.rawText) {
      throw new Error('저장할 대화 내용이 없습니다.');
    }

    const shortText = raw.rawText.length > 15000 
      ? raw.rawText.substring(0, 15000) + '\n...[truncated]' 
      : raw.rawText;

    console.log('[SnapshotLayer] 저장 시도, 길이:', shortText.length);

    // 1. hajunai_conversations 저장
    const saveRes = await fetch(SUPABASE_URL + '/rest/v1/hajunai_conversations', {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        project_id: PROJECT_ID,
        source_ai: raw.source,
        original_message: shortText,
        summary: raw.title
      })
    });

    if (!saveRes.ok) {
      const err = await saveRes.text();
      throw new Error('저장 실패 (' + saveRes.status + '): ' + err);
    }

    console.log('[SnapshotLayer] ✅ Supabase 저장 성공');

    // 2. Action Engine 실행 (Gemini 분석)
    let structured = null;
    if (geminiApiKey) {
      console.log('[SnapshotLayer] Action Engine 실행...');
      const actionResult = await analyzeWithGemini(geminiApiKey, shortText, raw.title);
      if (actionResult.result) {
        structured = actionResult.result;
        result.summary = structured.current_state || structured.next_action || '분석 완료';
        console.log('[Action Engine] 완료', structured);
      }
    }

    // 3. 🔥 contexts 업데이트 데이터 준비 (next_action 반드시 포함!)
    const updateData = {
      project_id: PROJECT_ID,
      last_task: structured?.last_task || raw.title || '스냅샷 저장',
      summary: structured?.current_state || structured?.summary || raw.title || '대화 저장',
      code_context: structured?.code_context || null,
      decisions: structured?.decisions || null,
      current_problems: structured?.blocker || structured?.current_problems || null,
      // 🔥🔥🔥 여기가 중요! 🔥🔥🔥
      next_action: structured?.next_action || null,      // 다음 행동
      action_reasoning: structured?.risk || null,       // 위험/이유
      // 🔥🔥🔥
      health_score: structured?.health_score || 85,
      updated_at: new Date().toISOString()
    };

    console.log('[SnapshotLayer] 저장할 데이터:', {
      next_action: updateData.next_action,
      current_problems: updateData.current_problems,
      summary: updateData.summary
    });

    // 4. contexts 저장 (PATCH 또는 INSERT)
    const ctxRes = await fetch(SUPABASE_URL + '/rest/v1/contexts?project_id=eq.' + PROJECT_ID, {
      method: 'PATCH',
      headers: {
        'apikey': supabaseKey,
        'Authorization': 'Bearer ' + supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updateData)
    });

    if (!ctxRes.ok && ctxRes.status === 404) {
      await fetch(SUPABASE_URL + '/rest/v1/contexts', {
        method: 'POST',
        headers: {
          'apikey': supabaseKey,
          'Authorization': 'Bearer ' + supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...updateData, created_at: new Date().toISOString() })
      });
    }

    // 5. Notion 저장
    if (notionApiKey && notionDbId && structured) {
      console.log('[SnapshotLayer] Notion 저장 시도...');
      await saveToNotion(
        raw.title,
        raw.source,
        structured.current_state || structured.summary || '분석 완료',
        raw.url,
        notionApiKey,
        notionDbId
      );
    }

    result.success = true;
    console.log('[SnapshotLayer] 🎉 모든 작업 완료!');

  } catch (e) {
    result._error = e.message;
    console.error('[SnapshotLayer] ❌', e);
  }

  return result;
}

// ==================== handleManualSnapshot ====================
async function handleManualSnapshot(data) {
  console.log('[handleManualSnapshot] 시작:', data.title);
  const ctx = ExtractLayer({ source: 'manual', ...data });
  if (ctx._error) {
    return { success: false, error: ctx._error };
  }
  const snapshotResult = await SnapshotLayer(ctx);
  return { 
    success: snapshotResult.success, 
    error: snapshotResult._error,
    summary: snapshotResult.summary
  };
}

console.log('[Background] 모든 초기화 완료, 대기 중...');