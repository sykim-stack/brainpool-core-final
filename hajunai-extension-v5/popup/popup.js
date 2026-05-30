// popup.js v5.1.8 — 최종 안정화 버전

// ========== 1. 하드코딩된 기본 문서 (폴백) ==========
const FALLBACK_DOCS = {
  master: {
    title: 'BRAINPOOL OS 통합 마스터 문서',
    content: `🧠 BRAINPOOL OS 통합 마스터 문서 v1.0
최종 업데이트: 2026-05-04 | 버전: v1.0

1. 프로젝트 정체성
BRAINPOOL OS는 단순한 번역기가 아닙니다. 번역 결과를 학습 자산으로 축적하고, 사용자가 의식하지 않는 사이에 언어 데이터가 쌓이며, 로그인 없이 디바이스 ID만으로 개인화되는 언어 생태계 플랫폼입니다.

2. 핵심 역발상
- 원본 → 번역이 아닌, 번역(크게) → 원본(작게)
- 로그인 필수 → 무로그인 (device_id)
- 번역은 1회성 → 모든 번역 = 영구 학습 자산
- 버튼은 잘 보이게 → 버튼은 숨기고 우연히 발견
- AI 번역 → DB 캐싱 → AI fallback

3. 기술 아키텍처
CoreRing (번역 엔진), CoreChat (채팅), CoreNull (커뮤니티)
API 라우트: /api/brainpool, /api/chat/send, /api/chat/rooms, /api/corenull
Supabase DB: chat_rooms, chat_messages, tb_trans_logs, core_users 등`
  },
  vaccine: {
    title: 'BRAINPOOL 통합 백신',
    content: `🛡️ BRAINPOOL 통합 백신 v1.0

[기술 실수 방지]
- UTF8-ALL: req.text() + JSON.parse() 사용, 응답 헤더 charset=utf-8
- UUID-TYPE: UUID 컬럼에 문자열 삽입 금지, isUUID() 검증 필수
- LANG-MAP: meta.sourceLang / payload.translated 필드명 정확히 사용
- VAR-DUP: 같은 함수 내 const payload 중복 선언 금지

[디자인·철학 오염 방지]
- 디자인 과잉 면역: 로고 키우기, 장식적 애니메이션 금지
- 말풍선 배치 원칙: 왼쪽 = 내 메시지, 오른쪽 = 상대 메시지 (언어 기준 금지)
- 비교 학습 보호: 번역 24px Bold + 원문 18px
- 기능 확장 억제: "없으면 불편하지 않을까?" → 그게 넣지 말아야 할 기능
- 데이터 순환 강제: emotionFilter, contextFilter 통과 후 저장`
  },
  contract: {
    title: 'BRAINPOOL 계약서',
    content: `📜 BRAINPOOL 계약서 (contract.md)

1. 함수 형태
- 모든 레이어 함수는 반드시 (ctx) => ctx 형태
- throw 절대 금지 → _error 필드로 반환

2. 핵심 규칙
- 에러 처리: throw 금지, ctx._error 필드에 문자열로 반환
- HTTP 응답: 200(에러 포함) 또는 500(치명적 오류)만 사용
- traceId: 모든 요청/응답에 포함, 없으면 자동 생성
- 전역 참조: 전역 스코프에서 ctx 참조 금지
- UTF-8: req.json() 금지 → req.text() + JSON.parse() 필수
- UUID 컬럼: "shark", "room_xxx" 등 문자열 삽입 금지
- invite_code: 정확히 6자 생성 함수로만 생성
- 언어 필드명: meta.sourceLang, payload.translated 고정 사용
- 변수명: const payload 중복 선언 금지`
  }
};

// ========== 2. 공통 유틸리티 ==========
function getSupabaseCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], (result) => resolve(result));
  });
}

// ========== 3. 문서 목록 및 프롬프트 생성 ==========
async function loadDocList() {
  const docListEl = document.getElementById('docList');
  if (!docListEl) return;
  let docs = [];
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/shark_memories?select=*&order=created_at.desc`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      if (res.ok) docs = await res.json();
    }
  } catch (e) { console.warn('Supabase 문서 로드 실패, 하드코딩 문서 사용'); }

  if (!docs.length) {
    docs = [
      { id: 'hard-master', doc_type: 'master', title: FALLBACK_DOCS.master.title, version: '1.0', content: FALLBACK_DOCS.master.content },
      { id: 'hard-vaccine', doc_type: 'vaccine', title: FALLBACK_DOCS.vaccine.title, version: '1.0', content: FALLBACK_DOCS.vaccine.content },
      { id: 'hard-contract', doc_type: 'contract', title: FALLBACK_DOCS.contract.title, version: '1.0', content: FALLBACK_DOCS.contract.content }
    ];
  }

  docListEl.innerHTML = docs.map(d => `
    <div class="record-card" style="cursor:pointer" data-id="${d.id}" data-type="${d.doc_type}">
      <div class="record-top">
        <span class="record-project">${d.doc_type === 'master' ? '🧠' : d.doc_type === 'vaccine' ? '🛡️' : '📜'} ${d.title}</span>
        <span class="record-time">v${d.version}</span>
      </div>
      <div style="font-size:11px; color:var(--text3)">${d.updated_at ? new Date(d.updated_at).toLocaleDateString() : ''}</div>
    </div>
  `).join('');

  docListEl.querySelectorAll('.record-card').forEach(card => {
    card.addEventListener('click', () => {
      const doc = docs.find(d => d.id === card.dataset.id);
      if (doc) showDocPreview(doc);
    });
  });
}

function showDocPreview(doc) {
  const preview = document.getElementById('promptPreview');
  if (!preview) return;
  
  preview.innerHTML = `<strong>${doc.title} (v${doc.version})</strong><br><br>${doc.content.replace(/\n/g, '<br>')}`;
  
  const activeTemplate = document.querySelector('.template-btn.active')?.dataset?.template;
  if (activeTemplate) buildPrompt(activeTemplate);
}

async function buildPrompt(template) {
  const preview = document.getElementById('promptPreview');
  if (!preview) return;
  let master, vaccine, contract;
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(`${supabaseUrl}/rest/v1/shark_memories?select=*`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      });
      if (res.ok) {
        const remoteDocs = await res.json();
        const rm = remoteDocs.find(d => d.doc_type === 'master');
        const rv = remoteDocs.find(d => d.doc_type === 'vaccine');
        const rc = remoteDocs.find(d => d.doc_type === 'contract');
        if (rm) master = rm.content;
        if (rv) vaccine = rv.content;
        if (rc) contract = rc.content;
      }
    }
  } catch (e) { /* 무시 */ }

  if (!master) master = FALLBACK_DOCS.master.content;
  if (!vaccine) vaccine = FALLBACK_DOCS.vaccine.content;
  if (!contract) contract = FALLBACK_DOCS.contract.content;

  let projectContext = '';
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (supabaseUrl && supabaseKey) {
      const res = await fetch(
        `${supabaseUrl}/rest/v1/contexts?project_id=eq.aaaaaaaa-0000-0000-0000-000000000001&select=*`,
        { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
      );
      if (res.ok) {
        const contexts = await res.json();
        if (contexts.length > 0) {
          const ctx = contexts[0];
          projectContext = `\n\n=== 📋 현재 프로젝트 상태 ===\n`;
          if (ctx.last_task) projectContext += `진행 중인 작업: ${ctx.last_task}\n`;
          if (ctx.code_context) projectContext += `관련 파일: ${ctx.code_context}\n`;
          if (ctx.current_problems) projectContext += `⚠️ 발생한 문제: ${ctx.current_problems}\n`;
          if (ctx.decisions) projectContext += `💡 최근 결정: ${ctx.decisions}\n`;
          if (ctx.next_tasks) {
            const nextTasks = typeof ctx.next_tasks === 'string' ? JSON.parse(ctx.next_tasks) : ctx.next_tasks;
            if (Array.isArray(nextTasks) && nextTasks.length > 0) {
              projectContext += `→ 다음 작업: ${nextTasks.join(', ')}\n`;
            }
          }
          projectContext += `건강 점수: ${ctx.health_score || 'N/A'}/100\n`;
        }
      }
    }
  } catch (e) { /* 무시 */ }

  const labels = { development: '🛠️ 개발', debug: '🔍 디버깅', review: '📋 리뷰' };
  let documents = '';
  if (template === 'development') {
    if (master) documents += `=== 📚 마스터 문서 ===\n${master}\n\n`;
    if (vaccine) documents += `=== 🛡️ 통합 백신 ===\n${vaccine}\n\n`;
    if (contract) documents += `=== 📜 계약서 ===\n${contract}`;
  } else if (template === 'debug') {
    if (vaccine) documents += `=== 🛡️ 통합 백신 ===\n${vaccine}`;
  } else if (template === 'review') {
    if (contract) documents += `=== 📜 계약서 ===\n${contract}`;
  }

  preview.innerHTML = `<strong>${labels[template]} 모드 프롬프트</strong><br><br>
    🦈 당신은 BRAINPOOL OS의 전문가입니다.<br>
    아래 문서를 완전히 이해하고, 이 규칙에 따라 작업하세요.<br>
    모든 함수는 (ctx) => ctx 형태로 작성하고, throw는 절대 사용하지 않습니다.<br><br>
    ${documents.replace(/\n/g, '<br>')}${projectContext.replace(/\n/g, '<br>')}`;
}

// ========== 4. 템플릿 버튼 ==========
function initTemplateBtns() {
  const btns = document.querySelectorAll('.template-btn');
  btns.forEach(btn => {
    btn.addEventListener('click', () => {
      btns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      buildPrompt(btn.dataset.template);
    });
  });
}

// ========== 5. 클립보드 복사 ==========
function initCopyBtn() {
  document.getElementById('btnCopyPrompt')?.addEventListener('click', async () => {
    const text = document.getElementById('promptPreview')?.innerText;
    if (!text) return;
    try { await navigator.clipboard.writeText(text); alert('✅ 복사 완료!'); }
    catch { alert('❌ 복사 실패'); }
  });
}

// ========== 6. 상태 체크 ==========
async function runHealthCheck() {
  const resultsContainer = document.getElementById('healthResults');
  const lastCheckEl = document.getElementById('lastCheckTime');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '<div class="loading-state">🩺 Supabase 연결 점검 중...</div>';

  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) {
      resultsContainer.innerHTML = `<div class="empty">⚠️ 설정 탭에서 Supabase URL과 Key를 먼저 연결해주세요.</div>`;
      if (lastCheckEl) lastCheckEl.textContent = '설정 필요';
      return;
    }

    const [convRes, ctxRes] = await Promise.allSettled([
      fetch(`${supabaseUrl}/rest/v1/hajunai_conversations?select=count&project_id=eq.aaaaaaaa-0000-0000-0000-000000000001&limit=1`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }),
      fetch(`${supabaseUrl}/rest/v1/contexts?project_id=eq.aaaaaaaa-0000-0000-0000-000000000001&select=health_score,last_task`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      })
    ]);

    let html = '';

    if (convRes.status === 'fulfilled' && convRes.value.ok) {
      html += `<div class="record-card" style="border-left:4px solid #3FB950"><span class="record-project">🟢 hajunai_conversations 정상</span></div>`;
    } else {
      html += `<div class="record-card" style="border-left:4px solid #F78166"><span class="record-project">🔴 hajunai_conversations 연결 실패</span></div>`;
    }

    if (ctxRes.status === 'fulfilled' && ctxRes.value.ok) {
      const data = await ctxRes.value.json();
      const ctx = data[0] || {};
      html += `<div class="record-card" style="border-left:4px solid #3FB950">
        <span class="record-project">🟢 contexts (건강 ${ctx.health_score || 'N/A'}/100)</span>
        <span class="record-time">${ctx.last_task || '기록 없음'}</span>
      </div>`;
    }

    resultsContainer.innerHTML = html || '<div class="empty">연결 확인됨</div>';
    if (lastCheckEl) lastCheckEl.textContent = new Date().toLocaleTimeString();

  } catch (e) {
    resultsContainer.innerHTML = `<div class="empty">⚠️ 연결 오류: ${e.message}</div>`;
  }
}

// ========== 7. 일정 관리 ==========
async function loadSchedules() {
  const listEl = document.getElementById('scheduleList');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading-state">📅 일정 불러오는 중...</div>';
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) {
      listEl.innerHTML = '<div class="empty">⚙️ 설정 탭에서 Supabase를 연결해주세요</div>';
      return;
    }
    const today = new Date().toISOString().slice(0, 10);
    const res = await fetch(
      `${supabaseUrl}/rest/v1/care_schedules?select=*&date=gte.${today}&order=date.asc&limit=10`,
      { headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` } }
    );
    if (!res.ok) throw new Error('일정을 불러오지 못했습니다');
    const schedules = await res.json();
    if (!schedules.length) { listEl.innerHTML = '<div class="empty">📭 예정된 일정이 없습니다</div>'; return; }
    listEl.innerHTML = schedules.map(s => `
      <div class="record-card" style="border-left: 4px solid #F0B429">
        <div class="record-top"><span class="record-project">📅 ${s.title}</span><span class="record-time">${s.date}</span></div>
        <div style="font-size: 11px; color: var(--text2)">${s.description || ''}</div>
      </div>
    `).join('');
  } catch (e) { listEl.innerHTML = `<div class="empty">⚠️ 로드 실패: ${e.message}</div>`; }
}

async function addSchedule() {
  const title = document.getElementById('scheduleTitle')?.value.trim();
  const date = document.getElementById('scheduleDate')?.value.trim();
  if (!title || !date) return alert('⚠️ 제목과 날짜를 모두 입력해주세요');
  const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
  if (!supabaseUrl || !supabaseKey) return alert('⚙️ 설정 탭에서 Supabase를 연결해주세요');
  try {
    await fetch(`${supabaseUrl}/rest/v1/care_schedules`, {
      method: 'POST',
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, date })
    });
    document.getElementById('scheduleTitle').value = '';
    document.getElementById('scheduleDate').value = '';
    loadSchedules();
    alert('✅ 일정이 저장되었습니다');
  } catch (e) { alert('❌ 저장 실패: ' + e.message); }
}

// ========== 8. 설정 저장 ==========
function initSettings() {
  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const url = document.getElementById('settingUrl')?.value || '';
    const key = document.getElementById('settingKey')?.value || '';
    const notionKey = document.getElementById('settingNotionKey')?.value || '';
    const notionDbId = document.getElementById('settingNotionDbId')?.value || '';
    const geminiKey = document.getElementById('settingGeminiKey')?.value || '';
    chrome.storage.local.set({ supabaseUrl: url, supabaseKey: key, notionApiKey: notionKey, notionDbId: notionDbId, geminiApiKey: geminiKey }, () => {
      alert('✅ 설정 저장 완료');
      loadDocList();
    });
  });
  chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'notionApiKey', 'notionDbId', 'geminiApiKey'], (result) => {
    if (document.getElementById('settingUrl')) document.getElementById('settingUrl').value = result.supabaseUrl || '';
    if (document.getElementById('settingKey')) document.getElementById('settingKey').value = result.supabaseKey || '';
    if (document.getElementById('settingNotionKey')) document.getElementById('settingNotionKey').value = result.notionApiKey || '';
    if (document.getElementById('settingNotionDbId')) document.getElementById('settingNotionDbId').value = result.notionDbId || '';
    if (document.getElementById('settingGeminiKey')) document.getElementById('settingGeminiKey').value = result.geminiApiKey || '';
  });
}

// ========== 9. 검증 탭 ==========
const validateStringLocal = (ctx) => {
  if (ctx._error) return ctx;
  try {
    if (!ctx.content || ctx.content.trim().length === 0) { ctx._error = '검사할 코드가 없습니다.'; return ctx; }
    ctx.lines = ctx.content.split('\n');
    ctx.violations = [];
    ctx.lines.forEach((line, index) => {
      if (/\b\d+px\b/.test(line)) {
        const isBorderOnePx = /\b(border|outline)\s*:\s*1px\s+(solid|dashed|dotted)/.test(line);
        if (!isBorderOnePx) ctx.violations.push({ ruleId: 'NO_PX', line: index + 1, message: `px 단위 사용: "${line.trim()}"`, suggestion: 'var(--space-*) 또는 var(--font-*) 토큰으로 교체하세요.' });
      }
      if (/#[0-9a-fA-F]{3,6}/.test(line)) ctx.violations.push({ ruleId: 'NO_HEX', line: index + 1, message: `hex 색상 직접 사용: "${line.trim()}"`, suggestion: 'var(--color-*) 또는 var(--bp-*) 토큰으로 교체하세요.' });
      if (/\bopacity\s*:\s*[\d.]+/.test(line)) ctx.violations.push({ ruleId: 'NO_OPACITY', line: index + 1, message: `opacity 직접 사용: "${line.trim()}"`, suggestion: 'var(--opacity-*) 토큰으로 교체하거나 rgba 색상을 사용하세요.' });
    });
    return ctx;
  } catch (e) { ctx._error = `검증 중 오류: ${e.message}`; return ctx; }
};

const summarizeViolationsLocal = (ctx) => {
  if (ctx._error) return ctx;
  if (!ctx.violations || ctx.violations.length === 0) { ctx.summary = '✅ 모든 계약서 규칙을 통과했습니다! 문제 없음.'; return ctx; }
  const grouped = {};
  ctx.violations.forEach(v => { if (!grouped[v.ruleId]) grouped[v.ruleId] = 0; grouped[v.ruleId]++; });
  let text = `🚨 ${ctx.violations.length}건의 계약 위반 발견:\n\n`;
  Object.entries(grouped).forEach(([rule, count]) => {
    const labels = { 'NO_PX': 'px 사용 금지', 'NO_HEX': 'hex 색상 금지', 'NO_OPACITY': 'opacity 금지' };
    text += `• ${labels[rule] || rule}: ${count}건\n`;
  });
  text += `\n⚠️ 수정 후 다시 검사하거나, 생성된 재질문 프롬프트를 Claude에게 보내세요.`;
  ctx.summary = text;
  return ctx;
};

const generateReprompt = (ctx) => {
  if (!ctx.violations || ctx.violations.length === 0) return ctx;
  let prompt = `🦈 Claude, 당신이 생성한 코드에서 다음 계약 위반 사항이 발견되었습니다. 아래 규칙에 맞게 코드를 수정해 주세요.\n\n[BRAINPOOL 계약서 핵심 규칙]\n- 모든 CSS 값은 토큰(var(--space-*), var(--font-*), var(--color-*))만 사용\n- px, hex(#ffffff), rgba, opacity 사용 금지\n- JSX 구조 변경 금지, 이벤트 로직 변경 금지\n- 함수는 (ctx) => ctx 패턴 유지, throw 금지\n\n[발견된 위반 사항]\n`;
  const grouped = {};
  ctx.violations.forEach(v => { if (!grouped[v.ruleId]) grouped[v.ruleId] = []; grouped[v.ruleId].push(v); });
  Object.entries(grouped).forEach(([ruleId, violations]) => {
    prompt += `\n## ${ruleId} (${violations.length}건)\n`;
    violations.forEach(v => { prompt += `- ${v.line ? '라인 ' + v.line + ': ' : ''}${v.message}\n  → ${v.suggestion}\n`; });
  });
  prompt += `\n[수정 요청]\n위 모든 사항을 수정한 전체 코드를 다시 출력해 주세요.`;
  ctx.reprompt = prompt;
  return ctx;
};

const runValidation = (ctx) => { ctx = validateStringLocal(ctx); ctx = summarizeViolationsLocal(ctx); if (ctx.violations?.length > 0) ctx = generateReprompt(ctx); return ctx; };

// ========== 10. 행동 탭 데이터 로드 ==========
async function loadActionTabData() {
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) return;
    
    const res = await fetch(`${supabaseUrl}/rest/v1/contexts?select=*&order=updated_at.desc&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (!res.ok) return;
    
    const contexts = await res.json();
    if (contexts.length > 0) {
      const ctx = contexts[0];
      
      // 기존 필드 업데이트
      const lastTaskEl = document.getElementById('actionLastTask');
      const problemEl = document.getElementById('actionProblem');
      const injectTaskEl = document.getElementById('injectLastTask');
      
      if (lastTaskEl) lastTaskEl.textContent = ctx.last_task || '기록 없음';
      if (problemEl) problemEl.textContent = ctx.current_problems || '없음';
      if (injectTaskEl) injectTaskEl.textContent = ctx.last_task || '기록 없음';
      
      // 🔥 Action Engine 결과 표시 (수정된 부분)
      const actionContainer = document.getElementById('actionEngineContainer');
      if (actionContainer) {
        if (ctx.next_action && ctx.next_action !== 'null' && ctx.next_action !== '') {
          actionContainer.innerHTML = `
            <div class="record-card" style="border-left: 4px solid var(--accent2); margin-top: 8px;">
              <div class="record-top">
                <span class="record-project">🎯 추천 다음 행동</span>
              </div>
              <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px;">${escapeHtml(ctx.next_action)}</div>
              <div style="font-size: 11px; color: var(--text2); margin-bottom: 4px;">📌 현재 상태: ${escapeHtml(ctx.summary || '분석 중')}</div>
              ${ctx.current_problems && ctx.current_problems !== '없음' ? `<div style="font-size: 11px; color: var(--warn);">⚠️ 문제: ${escapeHtml(ctx.current_problems)}</div>` : ''}
              ${ctx.action_reasoning && ctx.action_reasoning !== '없음' ? `<div style="font-size: 11px; color: var(--text2);">💡 ${escapeHtml(ctx.action_reasoning)}</div>` : ''}
              <div style="font-size: 10px; color: var(--accent); margin-top: 6px;">🏥 건강 점수: ${ctx.health_score || 'N/A'}/100</div>
            </div>
          `;
        } else {
          actionContainer.innerHTML = `
            <div class="record-card" style="border-left: 4px solid var(--text3); margin-top: 8px;">
              <div class="record-top">
                <span class="record-project">⏳ Action Engine 대기 중</span>
              </div>
              <div style="font-size: 12px; color: var(--text2);">대화를 저장하면 다음 행동이 추천됩니다.</div>
            </div>
          `;
        }
      }
    }
  } catch (e) { 
    console.warn('행동 탭 로드 실패:', e); 
  }
}

function initActionBtn() {
  document.getElementById('btnAction')?.addEventListener('click', async () => {
    let problemContext = '';
    let lastTaskText = '';
    let problemsText = '';
    try {
      const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
      if (supabaseUrl && supabaseKey) {
        const res = await fetch(`${supabaseUrl}/rest/v1/contexts?select=*&order=updated_at.desc&limit=1`, {
          headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
        });
        if (res.ok) {
          const contexts = await res.json();
          if (contexts.length > 0) {
            lastTaskText = contexts[0].last_task || '';
            problemsText = contexts[0].current_problems || '';
            problemContext = `\n\n[현재 문제]\n${problemsText}\n[마지막 작업]\n${lastTaskText}`;
          }
        }
      }
    } catch (e) { /* 무시 */ }

    let vaccineContent = FALLBACK_DOCS.vaccine.content;
    let contractContent = FALLBACK_DOCS.contract.content;

    const debugPrompt = `🦈 당신은 BRAINPOOL OS의 디버거입니다.\n아래 백신과 계약서를 기준으로 현재 발생한 문제를 분석하고, 원인을 찾아 해결하세요.\n에러는 반드시 _error 필드로 반환되어야 합니다.\n모든 함수는 (ctx) => ctx 형태로 작성하고, throw는 절대 사용하지 않습니다.\n\n=== 🛡️ 통합 백신 ===\n${vaccineContent}\n\n=== 📜 계약서 ===\n${contractContent}\n${problemContext}\n\n위 규칙을 기준으로 문제를 분석하고 해결 방안을 제시하세요.`;

    const preview = document.getElementById('promptPreview');
    if (preview) {
      preview.innerHTML = `<strong>🔍 디버깅 모드 프롬프트</strong><br><br>${debugPrompt.replace(/\n/g, '<br>')}`;
    }
    try { await navigator.clipboard.writeText(debugPrompt); alert('✅ 디버깅 프롬프트가 생성되어 클립보드에 복사되었습니다!\n새 채팅창에 붙여넣으세요.'); }
    catch { alert('🛠️ 프롬프트가 생성되었습니다. 주입 탭에서 복사하여 새 채팅방에 붙여넣으세요.'); }
  });
}

// ========== 11. 이어서 주입 ==========
async function buildContinuePrompt() {
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) {
      alert('⚙️ 설정 탭에서 Supabase를 연결해주세요');
      return;
    }

    const PROJECT_ID = 'aaaaaaaa-0000-0000-0000-000000000001';

    const [ctxRes, msgRes] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/contexts?project_id=eq.${PROJECT_ID}&select=*&order=updated_at.desc&limit=1`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      }),
      fetch(`${supabaseUrl}/rest/v1/messages?project_id=eq.${PROJECT_ID}&select=ai_source,content,created_at&order=created_at.desc&limit=3`, {
        headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
      })
    ]);

    const projectCtx = (ctxRes.ok ? await ctxRes.json() : [])[0] || {};
    const recent = (msgRes.ok ? await msgRes.json() : []);

    const recentSummary = recent.length > 0 
      ? recent.map(m => `• ${m.ai_source || 'AI'} (${new Date(m.created_at).toLocaleDateString()}): ${m.content?.substring(0, 70)}...`).join('\n')
      : '아직 저장된 대화 기록이 없습니다.';

    const prompt = `🦈 BRAINPOOL OS — 이어서 작업 (v5.1.6)

당신은 BRAINPOOL OS의 핵심 개발 AI입니다. 아래 모든 맥락을 완벽히 이해하고 이어서 작업하세요.

## 📊 현재 프로젝트 상태
진행 중인 작업: ${projectCtx.last_task || 'HajunAI 안정화 작업'}
관련 파일: ${projectCtx.code_context || 'popup.js, snapshot-layer.js'}
⚠️ 발생한 문제: ${projectCtx.current_problems || '없음'}
💡 최근 결정: ${projectCtx.decisions || 'Claude 셀렉터 개선'}
→ 다음 작업: ${projectCtx.next_tasks || '스냅샷 저장 안정화'}
건강 점수: ${projectCtx.health_score || '82'}/100

## 📚 최근 기록
${recentSummary}

=== 🛡️ 통합 백신 ===
${FALLBACK_DOCS.vaccine.content}

=== 📜 계약서 ===
${FALLBACK_DOCS.contract.content}

**위 모든 정보를 바탕으로 (ctx) => ctx 형태로 이어서 작업해주세요.**`;

    await navigator.clipboard.writeText(prompt);
    alert('✅ 강화된 이어서 작업 프롬프트가 복사되었습니다!');

  } catch (e) {
    alert('❌ 프롬프트 생성 실패: ' + e.message);
  }
}

// ========== 12. 스냅샷 저장 (탭 직접 스캔 방식) ==========

let currentTabs = [];

// 팝업 열릴 때마다 직접 탭 스캔
async function scanAITabs() {
  const listEl = document.getElementById('aiList');
  const saveBtn = document.getElementById('btnSaveNow');
  
  if (!listEl) return;
  
  listEl.innerHTML = '<div class="loading-state">🔍 AI 탭 직접 스캔 중...</div>';
  
  try {
    const allTabs = await chrome.tabs.query({});
    console.log('[scanAITabs] 전체 탭:', allTabs.length);
    
    const aiSites = ['claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai'];
    
    const aiTabs = allTabs.filter(tab => {
      if (!tab.url) return false;
      return aiSites.some(site => tab.url.includes(site));
    });
    
    console.log('[scanAITabs] AI 탭 발견:', aiTabs.length);
    
    currentTabs = aiTabs;
    
    if (aiTabs.length === 0) {
      listEl.innerHTML = `
        <div class="ai-item">
          <span class="ai-name">감지된 AI 없음</span>
          <span class="ai-status">대기</span>
        </div>
        <div style="font-size:11px; margin-top:8px;">💡 Claude/ChatGPT 탭을 열고 새로고침하세요</div>
      `;
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
    
    listEl.innerHTML = aiTabs.map(tab => `
      <div class="ai-item" data-tab-id="${tab.id}">
        <span class="ai-name">${getAIName(tab.url)}</span>
        <span class="ai-status active">● 연결됨</span>
      </div>
    `).join('');
    
    if (saveBtn) saveBtn.disabled = false;
    
  } catch (e) {
    console.error('[scanAITabs] 에러:', e);
    listEl.innerHTML = `<div class="empty">❌ 탭 접근 실패: ${e.message}</div>`;
    if (saveBtn) saveBtn.disabled = true;
  }
}

function getAIName(url) {
  if (!url) return 'AI';
  if (url.includes('claude.ai')) return 'Claude';
  if (url.includes('chatgpt.com')) return 'ChatGPT';
  if (url.includes('gemini.google.com')) return 'Gemini';
  if (url.includes('perplexity.ai')) return 'Perplexity';
  return 'AI';
}

// 저장 함수 (요약 표시 추가 버전)
async function saveCurrentConversation() {
  const btn = document.getElementById('btnSaveNow');
  if (!btn) return;

  if (currentTabs.length === 0) {
    alert('저장할 AI 탭이 없습니다.\nClaude 또는 ChatGPT 탭을 열어주세요.');
    return;
  }

  const tab = currentTabs[0];
  btn.disabled = true;
  btn.textContent = '⏳ 저장 중...';

  try {
    console.log('[save] 대상 탭:', tab.id, getAIName(tab.url));
    
    let result;
    
    // content.js 확인 및 주입
    try {
      const ping = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (ping === 'pong') {
        result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONVERSATION' });
      } else {
        throw new Error('Ping failed');
      }
    } catch (e) {
      console.log('[save] content.js 없음, 주입 시도');
      
      const injectResult = await sendMessageToBg({
        type: 'INJECT_CONTENT_SCRIPT',
        tabId: tab.id
      });
      
      if (!injectResult?.success) {
        throw new Error('content.js 주입 실패: ' + (injectResult?.error || '알 수 없는 오류'));
      }
      
      await new Promise(r => setTimeout(r, 500));
      result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONVERSATION' });
    }
    
    if (result?.error) throw new Error(result.error);
    if (!result?.text) throw new Error('대화 내용 없음');

    console.log('[save] 추출 성공, 길이:', result.text.length);

    const saveResult = await sendMessageToBg({
      type: 'MANUAL_SNAPSHOT',
      data: {
        text: result.text,
        title: result.title || getAIName(tab.url),
        url: result.url,
        ai: result.ai
      }
    });

    if (saveResult?.error) throw new Error(saveResult.error);

    btn.textContent = '✅ 저장 완료!';
    
    // 🔥 요약 표시 (추가된 부분!)
    if (saveResult.summary) {
      console.log('[save] 요약 표시:', saveResult.summary);
      showSummaryPopup(saveResult.summary);
    } else {
      console.log('[save] 요약 없음');
    }
    
    incrementAndUpdateCount();
    
    setTimeout(() => {
      btn.textContent = '📸 지금 저장';
      btn.disabled = false;
    }, 2000);

  } catch (e) {
    console.error('[save] 에러:', e);
    btn.textContent = '❌ 실패';
    
    let errorMsg = e.message;
    if (errorMsg.includes('Cannot access contents')) {
      errorMsg = '⚠️ 페이지 접근 권한이 없습니다.\n\n확장 프로그램을 다시 로드한 후 다시 시도해보세요.';
    } else if (errorMsg.includes('Could not establish connection')) {
      errorMsg = 'AI 탭과 연결할 수 없습니다.\n\n1. Claude/ChatGPT 탭 새로고침(F5)\n2. 다시 시도';
    }
    
    alert('저장 실패: ' + errorMsg);
    
    setTimeout(() => {
      btn.textContent = '📸 지금 저장';
      btn.disabled = false;
    }, 3000);
  }
}

// 스냅샷 카운트
function updateSnapshotCountDisplay() {
  chrome.storage.local.get(['todaySnapshotCount'], (result) => {
    const count = result.todaySnapshotCount || 0;
    const countEl = document.getElementById('snapshotCount');
    if (countEl) countEl.textContent = count;
  });
}

function incrementAndUpdateCount() {
  chrome.storage.local.get(['todaySnapshotCount'], (result) => {
    const count = (result.todaySnapshotCount || 0) + 1;
    chrome.storage.local.set({ todaySnapshotCount: count });
    const countEl = document.getElementById('snapshotCount');
    if (countEl) countEl.textContent = count;
  });
}

// 스냅샷 이벤트 초기화
function initSnapshotEvents() {
  console.log('[initSnapshotEvents] 초기화');
  
  const saveBtn = document.getElementById('btnSaveNow');
  if (saveBtn) {
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    newBtn.addEventListener('click', saveCurrentConversation);
  }
  
  const manualBtn = document.getElementById('btnManualSave');
  if (manualBtn) {
    const newBtn = manualBtn.cloneNode(true);
    manualBtn.parentNode.replaceChild(newBtn, manualBtn);
    newBtn.addEventListener('click', async () => {
      const text = document.getElementById('manualText')?.value.trim();
      if (!text) { alert('내용 입력'); return; }
      
      const btn = newBtn;
      btn.disabled = true;
      btn.textContent = '⏳ 저장...';
      
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'MANUAL_SNAPSHOT',
          data: { 
            text, 
            title: document.getElementById('manualTitle')?.value || '수동 입력' 
          }
        }, (response) => {
          if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
          else resolve(response || {});
        });
      });
      
      if (result?.error) {
        alert(`실패: ${result.error}`);
      } else {
        alert('✅ 저장 완료');
        document.getElementById('manualText').value = '';
        incrementAndUpdateCount();
      }
      
      btn.disabled = false;
      btn.textContent = '💾 수동 저장';
    });
  }
  
  const toggleBtn = document.getElementById('btnToggleManual');
  if (toggleBtn) {
    const newBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
    newBtn.addEventListener('click', () => {
      const manualDiv = document.getElementById('manualInput');
      if (manualDiv) manualDiv.classList.toggle('active');
    });
  }
}

// ========== 13. 탭 전환 ==========
function initTabs() {
  const tabs = document.querySelectorAll('.tab');
  const contents = document.querySelectorAll('.content');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const tabId = tab.getAttribute('data-tab');
      tabs.forEach(t => t.classList.remove('active'));
      contents.forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      const target = document.getElementById(`tab-${tabId}`);
      if (target) target.classList.add('active');

      if (tabId === 'status') runHealthCheck();
      if (tabId === 'action') { 
        loadActionTabData();
        scanAITabs();
        updateSnapshotCountDisplay();
      }
      if (tabId === 'inject') loadActionTabData();
      if (tabId === 'schedule') loadSchedules();
    });
  });
}

// ========== 14. DOM 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
  console.log('[DOM] Content Loaded');
  
  loadDocList();
  initTabs();
  initTemplateBtns();
  initCopyBtn();
  initActionBtn();
  initSettings();
  initSnapshotEvents();

  document.getElementById('btnRefreshHealth')?.addEventListener('click', runHealthCheck);
  document.getElementById('btnRefreshSchedule')?.addEventListener('click', loadSchedules);
  document.getElementById('btnAddSchedule')?.addEventListener('click', addSchedule);
  document.getElementById('btnInjectContinue')?.addEventListener('click', buildContinuePrompt);

  // 검증 탭
  const validateBtn = document.getElementById('validateBtn');
  const resultInput = document.getElementById('resultInput');
  const resultBox = document.getElementById('resultBox');
  const repromptArea = document.getElementById('repromptArea');
  const repromptBox = document.getElementById('repromptBox');
  const copyRepromptBtn = document.getElementById('copyRepromptBtn');

  chrome.storage.local.get(['validateInput', 'validateResult', 'validateReprompt'], (saved) => {
    if (resultInput && saved.validateInput) resultInput.value = saved.validateInput;
    if (resultBox && saved.validateResult) resultBox.textContent = saved.validateResult;
    if (repromptBox && saved.validateReprompt) { repromptBox.textContent = saved.validateReprompt; if (repromptArea) repromptArea.style.display = 'block'; }
  });

  if (resultInput) {
    resultInput.addEventListener('input', () => chrome.storage.local.set({ validateInput: resultInput.value }));
  }

  if (validateBtn) {
    validateBtn.addEventListener('click', () => {
      const ctx = { content: resultInput?.value || '', _error: null, violations: [], summary: '', reprompt: '' };
      const result = runValidation(ctx);
      if (resultBox) { resultBox.textContent = result._error || result.summary; chrome.storage.local.set({ validateResult: resultBox.textContent }); }
      if (result.reprompt) {
        if (repromptBox) { repromptBox.textContent = result.reprompt; chrome.storage.local.set({ validateReprompt: result.reprompt }); }
        if (repromptArea) repromptArea.style.display = 'block';
      } else { if (repromptArea) repromptArea.style.display = 'none'; chrome.storage.local.remove('validateReprompt'); }
    });
  }

  if (copyRepromptBtn) {
    copyRepromptBtn.addEventListener('click', () => {
      const text = repromptBox?.textContent || '';
      navigator.clipboard.writeText(text).then(() => alert('✅ 재질문 프롬프트 복사 완료! Claude에게 붙여넣으세요.'));
    });
  }

  document.getElementById('clearValidateBtn')?.addEventListener('click', () => {
    if (resultInput) resultInput.value = '';
    if (resultBox) resultBox.textContent = '검사 버튼을 클릭하면 결과가 여기에 표시됩니다.';
    if (repromptArea) repromptArea.style.display = 'none';
    if (repromptBox) repromptBox.textContent = '';
    chrome.storage.local.remove(['validateInput', 'validateResult', 'validateReprompt']);
  });

  // 날짜 변경 시 스냅샷 카운트 리셋
  chrome.storage.local.get(['lastResetDate'], (result) => {
    const today = new Date().toDateString();
    if (result.lastResetDate !== today) {
      chrome.storage.local.set({ todaySnapshotCount: 0, lastResetDate: today });
      updateSnapshotCountDisplay();
    } else {
      updateSnapshotCountDisplay();
    }
  });
});

// ========== 공통 메시지 전송 함수 ==========
function sendMessageToBg(msg) {
  return new Promise((resolve) => {
    console.log('[sendMessageToBg] 전송:', msg.type);
    
    const timeout = setTimeout(() => {
      console.log('[sendMessageToBg] 타임아웃:', msg.type);
      resolve({ error: 'timeout' });
    }, 10000);
    
    chrome.runtime.sendMessage(msg, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) {
        console.log('[sendMessageToBg] 에러:', chrome.runtime.lastError.message);
        resolve({ error: chrome.runtime.lastError.message });
      } else {
        console.log('[sendMessageToBg] 응답:', response);
        resolve(response || {});
      }
    });
  });
}

// 요약 팝업 표시 함수
// ========== 요약 표시 함수 ==========
function showSummaryPopup(summary) {
  // 기존 요약 영역 제거
  const existingDiv = document.getElementById('summaryDisplay');
  if (existingDiv) existingDiv.remove();
  
  // 새 요약 영역 생성
  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'summaryDisplay';
  summaryDiv.style.cssText = `
    margin-top: 12px;
    padding: 12px;
    background: var(--bg2);
    border-radius: var(--radius);
    border-left: 3px solid var(--accent2);
    font-size: 12px;
    animation: fadeIn 0.3s ease;
  `;
  
  summaryDiv.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span style="font-weight: 700; color: var(--accent2);">✨ Gemini 요약</span>
      <button id="closeSummaryBtn" style="background: none; border: none; color: var(--text3); cursor: pointer;">✕</button>
    </div>
    <div style="color: var(--text); line-height: 1.5;">${escapeHtml(summary)}</div>
  `;
  
  // 행동 탭에 추가
  const actionTab = document.getElementById('tab-action');
  const saveBtn = document.getElementById('btnSaveNow');
  
  if (saveBtn && saveBtn.parentNode) {
    saveBtn.insertAdjacentElement('afterend', summaryDiv);
  } else if (actionTab) {
    actionTab.appendChild(summaryDiv);
  }
  
  // 닫기 버튼
  document.getElementById('closeSummaryBtn')?.addEventListener('click', () => {
    summaryDiv.remove();
  });
  
  // 10초 후 자동 숨김
  setTimeout(() => {
    if (summaryDiv && summaryDiv.parentNode) {
      summaryDiv.style.opacity = '0';
      setTimeout(() => summaryDiv.remove(), 300);
    }
  }, 10000);
}

// HTML 이스케이프 함수 (XSS 방지)
function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// 스냅샷 카운트 관련 함수
function updateSnapshotCountDisplay() {
  chrome.storage.local.get(['todaySnapshotCount'], (result) => {
    const count = result.todaySnapshotCount || 0;
    const countEl = document.getElementById('snapshotCount');
    if (countEl) countEl.textContent = count;
  });
}

function incrementAndUpdateCount() {
  chrome.storage.local.get(['todaySnapshotCount'], (result) => {
    const count = (result.todaySnapshotCount || 0) + 1;
    chrome.storage.local.set({ todaySnapshotCount: count });
    const countEl = document.getElementById('snapshotCount');
    if (countEl) countEl.textContent = count;
  });
}

// getAIName 함수
function getAIName(url) {
  if (!url) return 'AI';
  if (url.includes('claude.ai')) return 'Claude';
  if (url.includes('chatgpt.com')) return 'ChatGPT';
  if (url.includes('gemini.google.com')) return 'Gemini';
  if (url.includes('perplexity.ai')) return 'Perplexity';
  return 'AI';
}