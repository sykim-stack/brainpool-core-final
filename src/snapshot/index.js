// src/snapshot/index.js
const BRAINPOOL_PATTERNS = [
  'BRAINPOOL Core — 이전 대화를 이어갑니다',
  'BRAINPOOL — 이어서 작업',
  '마지막 작업',
  '지금 바로 할 것',
  '현재 상황 요약',
  '위 맥락을 기반으로',
  '이전 맥락을 유지하며',
];

function isSystemMessage(content) {
  return BRAINPOOL_PATTERNS.some(p => content.includes(p));
}

export async function summarize(ctx) {
  const conversation = ctx.payload?.conversation;
  if (!conversation || conversation.length === 0) {
    ctx._error = "요약할 대화가 없습니다";
    return ctx;
  }

  const apiKey = ctx.config?.geminiApiKey;
  if (!apiKey) {
    ctx._error = "Gemini API Key가 필요합니다";
    return ctx;
  }

  try {
    const filtered = conversation.filter(m => {
      if (!m.content) return false;
      if (m.role === 'system') return false;
      return !isSystemMessage(m.content);
    });

    if (filtered.length === 0) {
      ctx._error = '분석할 실제 대화 내용이 부족합니다';
      return ctx;
    }

    const text = filtered
      .map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`)
      .join('\n\n');

    const prompt = `당신은 개발자 대화를 분석하여 구체적인 다음 행동을 추천하는 AI입니다.
대화 내용을 읽고, 반드시 유효한 JSON 객체만 출력하세요. 마크다운 금지.

필드:
- "last_task": 지금까지 한 주요 작업 (한 줄, 최대 80자, 마크다운 금지)
- "summary": 핵심 요약 (100자 이내, 줄바꿈 없이 한 줄, 마크다운 금지, 제목/헤더 금지)
- "next_action": 아래 우선순위로 판단

next_action 판단 우선순위:
1. 에러/오류 존재 → "오류 해결: [파일명] - [해결 방법]"
2. 막혀있고 원인 불명 → "확인 필요: [사항] - [방법]"
3. 선택 필요 → "결정 필요: [A] vs [B] - [기준]"
4. 정상 진행 → "구현: [작업명] - [파일 또는 위치]"
fallback → "정리: [완료 내용] - 다음 세션 이어갈 것"

중요: summary는 반드시 100자 이내 평문 한 줄. 마크다운 절대 금지.

대화 내용:
${text}`;

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 400 }
        })
      }
    );

    if (!response.ok) {
      ctx._error = `Gemini API 오류: ${await response.text()}`;
      return ctx;
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    const summaryObj = parseGeminiJSON(rawText, filtered);

    ctx.payload.summary = {
      last_task: summaryObj.last_task,
      summary: summaryObj.summary,
      next_action: resolveNextAction(summaryObj.next_action, filtered)
    };

    return ctx;

  } catch (e) {
    ctx._error = `요약 실패: ${e.message}`;
    return ctx;
  }
}

function parseGeminiJSON(rawText, conversation) {
  let cleaned = rawText.replace(/```json\s*/g, '').replace(/```/g, '').trim();
  const jsonMatch = cleaned.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return makeFallback(conversation, rawText);

  const fixedJSON = jsonMatch[0].replace(
    /("(?:[^"\\]|\\.)*")/g,
    match => match.replace(/\n/g, ' ').replace(/\r/g, '')
  );

  try {
    const parsed = JSON.parse(fixedJSON);
    if (parsed.last_task || parsed.summary || parsed.next_action) return parsed;
    return makeFallback(conversation, rawText);
  } catch (e) {
    return makeFallback(conversation, rawText);
  }
}

function makeFallback(conversation, rawText) {
  const lastUser = conversation.filter(m => m.role === 'user').pop();
  const lastAI = conversation.filter(m => m.role === 'assistant').pop();
  return {
    last_task: lastUser?.content?.substring(0, 80) || '작업 진행 중',
    summary: lastAI?.content?.substring(0, 100).replace(/\n/g, ' ').replace(/#+/g, '').trim()
      || lastUser?.content?.substring(0, 100).replace(/\n/g, ' ').trim()
      || '대화 내용 분석 실패',
    next_action: ''
  };
}

function resolveNextAction(nextAction, conversation) {
  const valid = nextAction
    && nextAction.length >= 10
    && nextAction !== '결정 필요'
    && nextAction !== '없음'
    && !nextAction.includes('이어서 작업');

  if (valid) return nextAction;

  const lastAI = conversation.filter(m => m.role === 'assistant').pop()?.content || '';
  const lastUser = conversation.filter(m => m.role === 'user').pop()?.content || '';
  const combined = lastAI + lastUser;

  if (combined.includes('CSS') || combined.includes('token') || combined.includes('var(--'))
    return '구현: CSS 토큰 적용 - globals.css 기준 확인';
  if (combined.includes('ctx._error') || combined.includes('_error'))
    return '구현: 에러 핸들링 - ctx._error 흐름 점검';
  if (combined.includes('Supabase') || combined.includes('migration'))
    return '구현: DB 마이그레이션 - Supabase 테이블 확인';
  if (combined.includes('CoreNull') || combined.includes('CoreHub') || combined.includes('CoreRing'))
    return '구현: Core 모듈 작업 - runCoreFlow 파이프라인 확인';
  if (combined.includes('번역') || combined.includes('DeepL') || combined.includes('Korean') || combined.includes('Vietnamese'))
    return '구현: 번역 파이프라인 - DeepL API 예외처리 확인';
  if (combined.includes('404') || combined.includes('오류') || combined.includes('error'))
    return '오류 해결: 에러 로그 확인 - Vercel 배포 상태 점검';
  if (combined.includes('HajunAI') || combined.includes('하준아이'))
    return '구현: HajunAI Light - 현재 작업 파일 이어서 진행';

  return lastAI.length > 10
    ? `구현: ${lastAI.substring(0, 60).replace(/\n/g, ' ')}...`
    : '정리: 작업 완료 - 다음 세션 이어갈 것';
}

export async function save(ctx) {
  const storage = ctx.storage;
  if (!storage) { ctx._error = "storage가 초기화되지 않았습니다"; return ctx; }

  const records = (ctx.payload.conversation || []).map(msg => ({
    project_id: ctx.payload.project_id || 'default',
    role: msg.role,
    content: msg.content,
    ai_source: msg.ai_source,
    type: 'snapshot',
    created_at: new Date().toISOString()
  }));

  if (records.length === 0) { ctx._error = "저장할 메시지가 없습니다"; return ctx; }

  await storage.post({ table: 'messages', payload: records }, ctx);
  return ctx;
}
