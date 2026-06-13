// BRAINPOOL Core Extension — popup.js (HajunCore v0.9 완전 연결)

let InjectLayer = null;
let SupabaseClientFn = null;
let getLatestContextFn = null;

async function loadHajunCore() {
  try {
    const mod = await import(chrome.runtime.getURL('src/hajuncore/index.js'));
    const storageMod = await import(chrome.runtime.getURL('src/hajuncore/storage/supabase.js'));
    InjectLayer = mod.InjectLayer;
    SupabaseClientFn = storageMod.SupabaseClient;
    getLatestContextFn = storageMod.getLatestContext;
    console.log("[popup] ✅ HajunCore 완전 로드");
  } catch (e) {
    console.error("[popup] ❌ HajunCore 로드 실패", e);
  }
}
loadHajunCore();

function getSupabaseCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], (result) => resolve(result));
  });
}

// ========== 상태 체크 ==========
async function runHealthCheck() {
  const resultsContainer = document.getElementById('healthResults');
  const lastCheckEl = document.getElementById('lastCheckTime');
  if (!resultsContainer) return;
  resultsContainer.innerHTML = '<div class="loading-state">🩺 Supabase 연결 확인 중...</div>';
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) {
      resultsContainer.innerHTML = `<div class="empty">⚠️ 설정 탭에서 Supabase URL과 Key를 먼저 연결해주세요.</div>`;
      if (lastCheckEl) lastCheckEl.textContent = '설정 필요';
      return;
    }
    const response = await fetch(`${supabaseUrl}/rest/v1/hajunai_conversations?select=count&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    const text = await response.text();
    let ok = false;
    try { const data = JSON.parse(text); ok = !data.error; } catch(e) { ok = false; }
    if (ok) {
      resultsContainer.innerHTML = `<div class="record-card" style="border-left:4px solid #3FB950"><span class="record-project">🟢 Supabase 연결 정상</span></div>`;
    } else {
      resultsContainer.innerHTML = `<div class="record-card" style="border-left:4px solid #F78166"><span class="record-project">🔴 Supabase 연결 실패</span></div>`;
    }
    if (lastCheckEl) lastCheckEl.textContent = new Date().toLocaleTimeString();
  } catch (e) {
    resultsContainer.innerHTML = `<div class="empty">⚠️ 연결 오류: ${e.message}</div>`;
  }
}

// ========== 설정 ==========
function initSettings() {
  document.getElementById('btnSaveSettings')?.addEventListener('click', () => {
    const url = document.getElementById('settingUrl')?.value || '';
    const key = document.getElementById('settingKey')?.value || '';
    const notionKey = document.getElementById('settingNotionKey')?.value || '';
    const notionDbId = document.getElementById('settingNotionDbId')?.value || '';
    const geminiKey = document.getElementById('settingGeminiKey')?.value || '';
    chrome.storage.local.set(
      { supabaseUrl: url, supabaseKey: key, notionApiKey: notionKey, notionDbId: notionDbId, geminiApiKey: geminiKey },
      () => alert('✅ 설정 저장 완료')
    );
  });
  chrome.storage.local.get(['supabaseUrl', 'supabaseKey', 'notionApiKey', 'notionDbId', 'geminiApiKey'], (result) => {
    if (document.getElementById('settingUrl')) document.getElementById('settingUrl').value = result.supabaseUrl || '';
    if (document.getElementById('settingKey')) document.getElementById('settingKey').value = result.supabaseKey || '';
    if (document.getElementById('settingNotionKey')) document.getElementById('settingNotionKey').value = result.notionApiKey || '';
    if (document.getElementById('settingNotionDbId')) document.getElementById('settingNotionDbId').value = result.notionDbId || '';
    if (document.getElementById('settingGeminiKey')) document.getElementById('settingGeminiKey').value = result.geminiApiKey || '';
  });
}

// ========== Action Engine ==========
async function loadActionTabData() {
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) return;
    const res = await fetch(`${supabaseUrl}/rest/v1/contexts?select=next_action,action_reasoning,summary,current_problems,health_score&order=updated_at.desc&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (!res.ok) return;
    const contexts = await res.json();
    if (contexts.length === 0) return;
    const ctx = contexts[0];
    const actionContainer = document.getElementById('actionEngineContainer');
    if (!actionContainer) return;
    if (ctx.next_action && ctx.next_action !== 'null' && ctx.next_action !== '') {
      actionContainer.innerHTML = `
        <div class="record-card" style="border-left: 4px solid var(--accent2); margin-top: 8px;">
          <div class="record-top"><span class="record-project">🎯 추천 다음 행동</span></div>
          <div style="font-size: 13px; font-weight: 500; margin-bottom: 4px;">${escapeHtml(ctx.next_action)}</div>
          <div style="font-size: 11px; color: var(--text2); margin-bottom: 4px;">📌 현재 상태: ${escapeHtml(ctx.summary || '분석 중')}</div>
          ${ctx.current_problems && ctx.current_problems !== '없음' ? `<div style="font-size: 11px; color: var(--warn);">⚠️ 문제: ${escapeHtml(ctx.current_problems)}</div>` : ''}
          ${ctx.action_reasoning && ctx.action_reasoning !== '없음' ? `<div style="font-size: 11px; color: var(--text2);">💡 ${escapeHtml(ctx.action_reasoning)}</div>` : ''}
          <div style="font-size: 10px; color: var(--accent); margin-top: 6px;">🏥 건강 점수: ${ctx.health_score || 'N/A'}/100</div>
        </div>`;
    } else {
      actionContainer.innerHTML = `
        <div class="record-card" style="border-left: 4px solid var(--text3); margin-top: 8px;">
          <div class="record-top"><span class="record-project">⏳ Action Engine 대기 중</span></div>
          <div style="font-size: 12px; color: var(--text2);">대화를 저장하면 다음 행동이 추천됩니다.</div>
        </div>`;
    }
  } catch(e) { console.warn('Action 데이터 로드 실패:', e); }
}

// ========== AI 탭 스캔 ==========
let currentTabs = [];

async function scanAITabs() {
  const listEl = document.getElementById('aiList');
  const saveBtn = document.getElementById('btnSaveNow');
  if (!listEl) return;
  listEl.innerHTML = '<div class="loading-state">🔍 AI 탭 스캔 중...</div>';
  try {
    const allTabs = await chrome.tabs.query({});
    const aiSites = ['claude.ai', 'chatgpt.com', 'gemini.google.com', 'perplexity.ai'];
    const aiTabs = allTabs.filter(tab => tab.url && aiSites.some(site => tab.url.includes(site)));
    currentTabs = aiTabs;
    if (aiTabs.length === 0) {
      listEl.innerHTML = `<div class="ai-item"><span class="ai-name">감지된 AI 없음</span><span class="ai-status">대기</span></div>
        <div style="font-size:11px; margin-top:8px;">💡 Claude/ChatGPT/Gemini/Perplexity 탭을 열고 새로고침하세요</div>`;
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
    listEl.innerHTML = aiTabs.map(tab => `
      <div class="ai-item" data-tab-id="${tab.id}">
        <span class="ai-name">${getAIName(tab.url)}</span>
        <span class="ai-status active">● 연결됨</span>
      </div>`).join('');
    if (saveBtn) saveBtn.disabled = false;
  } catch(e) {
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

// ========== 저장 (단일 버전, HajunCore 완전 연결) ==========
async function saveCurrentConversation() {
  const btn = document.getElementById('btnSaveNow');
  if (!btn) return;
  if (currentTabs.length === 0) { alert('저장할 AI 탭이 없습니다.'); return; }
  const tab = currentTabs[0];
  btn.disabled = true;
  btn.textContent = '⏳ 저장 중...';
  try {
    let result;
    try {
      const ping = await chrome.tabs.sendMessage(tab.id, { type: 'PING' });
      if (ping === 'pong') result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONVERSATION' });
      else throw new Error('Ping failed');
    } catch(e) {
      const injectResult = await sendMessageToBg({ type: 'INJECT_CONTENT_SCRIPT', tabId: tab.id });
      if (!injectResult?.success) throw new Error('content.js 주입 실패');
      await new Promise(r => setTimeout(r, 500));
      result = await chrome.tabs.sendMessage(tab.id, { type: 'EXTRACT_CONVERSATION' });
    }
    if (result?.error) throw new Error(result.error);
    if (!result?.text) throw new Error('대화 내용 없음');

    const saveResult = await sendMessageToBg({
      type: 'MANUAL_SNAPSHOT',
      data: { text: result.text, conversation: result.data || [], title: result.title || getAIName(tab.url), url: result.url, ai: result.ai }
    });
    if (saveResult?.error) throw new Error(saveResult.error);

    btn.textContent = '✅ 저장 완료!';

    // InjectLayer — latestContext 완전 연결
    if (InjectLayer && SupabaseClientFn && getLatestContextFn) {
      const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
      let ctx = { supabaseUrl, supabaseKey };
      ctx = SupabaseClientFn(ctx);
      ctx = await getLatestContextFn(ctx);
      ctx = InjectLayer(ctx);

      if (!ctx._error && ctx.injectionPrompt) {
        const promptBox = document.getElementById('promptBox');
        const summaryArea = document.getElementById('summaryArea');
        const summaryText = document.getElementById('summaryText');
        if (promptBox && summaryArea) {
          if (summaryText) summaryText.innerText = saveResult.summary || '';
          promptBox.innerText = ctx.injectionPrompt;
          summaryArea.style.display = 'block';
          chrome.storage.local.set({ lastSummary: saveResult.summary || '', lastPrompt: ctx.injectionPrompt });
          document.getElementById('btnCopyPrompt').onclick = () => {
            navigator.clipboard.writeText(ctx.injectionPrompt);
            alert('✅ 프롬프트 복사 완료');
          };
        }
      }
    }

    incrementAndUpdateCount();
    setTimeout(() => { btn.textContent = '📸 지금 저장'; btn.disabled = false; }, 2000);
  } catch(e) {
    btn.textContent = '❌ 실패';
    alert('저장 실패: ' + e.message);
    setTimeout(() => { btn.textContent = '📸 지금 저장'; btn.disabled = false; }, 3000);
  }
}

// ========== 이어가기 프롬프트 생성 ==========
async function generateContinuePrompt() {
  const btn = document.getElementById('btnContinueContext');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 맥락 분석 중...'; }
  try {
    if (!InjectLayer || !SupabaseClientFn || !getLatestContextFn) throw new Error('HajunCore 로드 안됨');
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) throw new Error('Supabase 설정 필요');

    let ctx = { supabaseUrl, supabaseKey };
    ctx = SupabaseClientFn(ctx);
    ctx = await getLatestContextFn(ctx);
    ctx = InjectLayer(ctx);

    if (ctx._error) throw new Error(ctx._error);

    await navigator.clipboard.writeText(ctx.injectionPrompt);
    alert('✅ HajunAI 맥락 주입 프롬프트 복사 완료!\nAI 채팅창에 붙여넣으세요.');

    const promptBox = document.getElementById('promptBox');
    const summaryArea = document.getElementById('summaryArea');
    if (promptBox && summaryArea) {
      promptBox.innerText = ctx.injectionPrompt;
      summaryArea.style.display = 'block';
    }
  } catch(e) {
    alert(`❌ 맥락 주입 실패: ${e.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '💉 "어제 이어서" 프롬프트 생성'; }
  }
}

// ========== 카운트 ==========
function updateSnapshotCountDisplay() {
  chrome.storage.local.get(['todaySnapshotCount'], (result) => {
    const countEl = document.getElementById('snapshotCount');
    if (countEl) countEl.textContent = result.todaySnapshotCount || 0;
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

// ========== 수동 저장 ==========
function initSnapshotEvents() {
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
      newBtn.disabled = true;
      newBtn.textContent = '⏳ 저장...';
      const result = await sendMessageToBg({
        type: 'MANUAL_SNAPSHOT',
        data: { text, title: document.getElementById('manualTitle')?.value || '수동 입력' }
      });
      if (result?.error) alert(`실패: ${result.error}`);
      else {
        alert('✅ 저장 완료');
        document.getElementById('manualText').value = '';
        incrementAndUpdateCount();
      }
      newBtn.disabled = false;
      newBtn.textContent = '💾 수동 저장';
    });
  }
  const toggleBtn = document.getElementById('btnToggleManual');
  if (toggleBtn) {
    const newBtn = toggleBtn.cloneNode(true);
    toggleBtn.parentNode.replaceChild(newBtn, toggleBtn);
    newBtn.addEventListener('click', () => {
      document.getElementById('manualInput')?.classList.toggle('active');
    });
  }
}

// ========== 탭 전환 ==========
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
      if (tabId === 'action') { loadActionTabData(); scanAITabs(); updateSnapshotCountDisplay(); }
    });
  });
}

function sendMessageToBg(msg) {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve({ error: 'timeout' }), 10000);
    chrome.runtime.sendMessage(msg, (response) => {
      clearTimeout(timeout);
      if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
      else resolve(response || {});
    });
  });
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettings();
  initSnapshotEvents();

  document.getElementById('btnRefreshHealth')?.addEventListener('click', runHealthCheck);
  document.getElementById('btnContinueContext')?.addEventListener('click', generateContinuePrompt);

  runHealthCheck();
  scanAITabs();
  updateSnapshotCountDisplay();

  chrome.storage.local.get(['lastSummary', 'lastPrompt'], (result) => {
    if (result.lastSummary) {
      const summaryText = document.getElementById('summaryText');
      const promptBox = document.getElementById('promptBox');
      const summaryArea = document.getElementById('summaryArea');
      if (summaryText) summaryText.innerText = result.lastSummary;
      if (promptBox) promptBox.innerText = result.lastPrompt || '(저장된 프롬프트 없음)';
      if (summaryArea) summaryArea.style.display = 'block';
      document.getElementById('btnCopyPrompt')?.addEventListener('click', () => {
        navigator.clipboard.writeText(promptBox?.innerText || '');
        alert('✅ 프롬프트 복사됨');
      });
    }
  });
});
