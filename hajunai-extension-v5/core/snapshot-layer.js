// core/snapshot-layer.js — v5.1.7 스냅샷 저장 안정화
import { createTraceId, sanitizeText } from './extract-layer.js';

const SUPABASE_URL = 'https://grlfocvlfatuvphkyivd.supabase.co';
const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

export async function SnapshotLayer(ctx) {
  const result = {
    snapshotId: null,
    contextUpdated: false,
    summary: null,
    _error: null,
    traceId: createTraceId()
  };

  console.group('🔍 [SnapshotLayer] 저장 시도 시작');
  console.log('TraceId:', result.traceId);
  console.log('raw data 존재?', !!ctx.rawConversation?.rawText);
  console.log('rawText 길이:', ctx.rawConversation?.rawText?.length || 0);

  try {
    const { supabaseKey, geminiApiKey } = await chrome.storage.local.get(['supabaseKey', 'geminiApiKey']);
    console.log('Supabase Key 존재?', !!supabaseKey);
    
    if (!supabaseKey) {
      result._error = 'Supabase Key가 설정되지 않았습니다.';
      console.error(result._error);
      console.groupEnd();
      return result;
    }

    const raw = ctx.rawConversation || ctx;
    if (!raw.rawText || raw.rawText.length < 30) {
      result._error = `대화 내용 부족 (${raw.rawText?.length || 0}자)`;
      console.error(result._error);
      console.groupEnd();
      return result;
    }

    // 1. messages 테이블 저장 (안전하게)
    const messageData = {
      project_id: PROJECT_ID,
      role: 'snapshot',
      content: sanitizeText(raw.rawText, 13000),
      ai_source: raw.source || raw.ai || 'manual',
      meta: {
        traceId: result.traceId,
        extractedAt: new Date().toISOString(),
        url: raw.url || null,
        messageCount: raw.messageCount || null
      }
    };

    const saved = await saveMessage(supabaseKey, messageData);
    result.snapshotId = saved?.id;

    console.log(`[SnapshotLayer] ✅ 메시지 저장 성공 (ID: ${result.snapshotId})`);

    // 2. Gemini 요약 + contexts 업데이트
    if (geminiApiKey && raw.rawText.length > 200) {
      const summary = await summarizeWithGemini(geminiApiKey, raw.rawText);
      if (summary) {
        result.summary = summary;
        await updateContext(supabaseKey, summary, raw.source || raw.ai);
        result.contextUpdated = true;
      }
    }

  } catch (e) {
    result._error = `SnapshotLayer 실패: ${e.message}`;
    console.error('[SnapshotLayer]', e);
  }

  return result;
}

// Gemini 요약 (2.5 Flash 권장)
async function summarizeWithGemini(apiKey, text) {
  const prompt = `당신은 BRAINPOOL OS의 맥락 정리 전문가입니다.
다음 AI 대화 내용을 분석하여, 아래 JSON 형식으로 정리해주세요.
JSON 이외의 설명은 절대 포함하지 마세요.

{
  "last_task": "현재 진행 중인 작업 (한국어 1문장)",
  "code_context": "작업 중인 파일들 (예: api/posts.js, event.html)",
  "summary": "오늘 작업에 대한 2-3문장 요약",
  "decisions": "오늘 내린 중요한 결정사항 (없으면 null)",
  "current_module": "CoreRing | CoreChat | CoreNull | CoreHub | General",
  "health_score": 80
}

대화 내용:
${text.substring(0, 8000)}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    }
  );

  const data = await response.json();
  if (data.error) throw new Error(data.error.message);

  const rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawOutput) return null;

  const start = rawOutput.indexOf('{');
  const end = rawOutput.lastIndexOf('}') + 1;
  if (start === -1 || end === 0) return null;

  return JSON.parse(rawOutput.substring(start, end));
}

// messages 저장
async function saveMessage(supabaseKey, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/messages`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(data)
    });
  
    if (!res.ok) {
      const errorBody = await res.text();
      throw new Error(`messages 저장 실패: ${res.status} - ${errorBody}`);
    }
    return (await res.json())[0];
  }
  
  // contexts upsert (더 안전한 방식)
  async function updateContext(supabaseKey, summary, source) {
    const updateData = {
      project_id: PROJECT_ID,
      last_task: summary.last_task || '스냅샷 저장',
      summary: summary.summary || null,
      code_context: summary.code_context || null,
      decisions: summary.decisions || null,
      current_module: summary.current_module || 'General',
      health_score: summary.health_score || 82,
      source: source || 'manual',
      updated_at: new Date().toISOString()
    };
  
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/contexts?project_id=eq.${PROJECT_ID}`,
      {
        method: 'PATCH',                    // PATCH + filter 방식 추천
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=minimal'
        },
        body: JSON.stringify(updateData)
      }
    );
  
    if (!res.ok) {
      // row가 없으면 INSERT 시도
      if (res.status === 406 || res.status === 404) {
        return await insertContext(supabaseKey, updateData);
      }
      const errorBody = await res.text();
      throw new Error(`contexts 업데이트 실패: ${res.status} - ${errorBody}`);
    }
    return true;
  }
  
  async function insertContext(supabaseKey, data) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/contexts`, {
      method: 'POST',
      headers: {
        'apikey': supabaseKey,
        'Authorization': `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    return res.ok;
  }