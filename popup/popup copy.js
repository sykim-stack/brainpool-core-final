// BRAINPOOL Core Extension — 최종 통합 popup.js
// 기능: AI 탭 감지 + 저장 + 요약/프롬프트 표시 + Action Engine + 이어가기 프롬프트 복사
// HajunCore import (Chrome Extension 환경)

// ========== HajunCore 로드 (popup 전용) ==========
let InjectLayer = null;

async function loadHajunCore() {
  try {
    // popup 폴더 기준으로 src 상위 경로 지정
    const module = await import(chrome.runtime.getURL('src/hajuncore/index.js'));
    InjectLayer = module.InjectLayer;
    console.log("[popup] ✅ HajunCore InjectLayer 로드 성공");
  } catch (e) {
    console.error("[popup] ❌ HajunCore 로드 실패", e);
  }
}

// DOMContentLoaded 전에 호출
loadHajunCore();

// DOMContentLoaded 전에 호출
loadHajunCore();

// ========== 1. 공통 유틸리티 ==========
function getSupabaseCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], (result) => resolve(result));
  });
}

// ========== 2. 상태 체크 (Supabase 연결) ==========
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
    try {
      const data = JSON.parse(text);
      ok = !data.error;
    } catch(e) { ok = false; }

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

// ========== 3. 설정 저장 ==========
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

// ========== 4. Action Engine 데이터 로드 ==========
async function loadActionTabData() {
  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) return;

    const res = await fetch(`${supabaseUrl}/rest/v1/contexts?select=next_action,action_reasoning,summary,current_problems,health_score&order=updated_at.desc&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });
    if (!res.ok) return;

    const text = await res.text();
    let contexts = [];
    try { contexts = JSON.parse(text); } catch(e) { return; }
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
        </div>
      `;
    } else {
      actionContainer.innerHTML = `
        <div class="record-card" style="border-left: 4px solid var(--text3); margin-top: 8px;">
          <div class="record-top"><span class="record-project">⏳ Action Engine 대기 중</span></div>
          <div style="font-size: 12px; color: var(--text2);">대화를 저장하면 다음 행동이 추천됩니다.</div>
        </div>
      `;
    }
  } catch(e) { console.warn('Action 데이터 로드 실패:', e); }
}

// ========== 5. AI 탭 스캔 및 저장 ==========
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
      </div>
    `).join('');
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

// 저장 함수 - 저장 후 요약/프롬프트 표시 영역 업데이트
async function saveCurrentConversation() {
  const btn = document.getElementById('btnSaveNow');
  if (!btn) return;
  if (currentTabs.length === 0) {
    alert('저장할 AI 탭이 없습니다.\nAI 탭을 열어주세요.');
    return;
  }
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
      if (!injectResult?.success) throw new Error('content.js 주입 실패: ' + (injectResult?.error || ''));
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

// 요약 및 프롬프트 영역 업데이트 (항상 보이도록)
const summaryArea = document.getElementById('summaryArea');
if (summaryArea && saveResult.summary) {
  document.getElementById('summaryText').innerText = saveResult.summary;
  document.getElementById('promptBox').innerText = saveResult.prompt || '(프롬프트 없음)';
  summaryArea.style.display = 'block';   // 강제 표시
  // 프롬프트 복사 버튼 이벤트 (매번 새로 연결)
const copyBtn = document.getElementById('btnCopyPrompt');
if (copyBtn) {
  // 기존 이벤트 제거 (중복 방지)
  const newCopyBtn = copyBtn.cloneNode(true);
  copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
  newCopyBtn.addEventListener('click', () => {
    const promptText = document.getElementById('promptBox')?.innerText || '';
    if (promptText) {
      navigator.clipboard.writeText(promptText);
      alert('✅ 프롬프트가 클립보드에 복사되었습니다.');
    } else {
      alert('❌ 복사할 프롬프트가 없습니다.');
    }
  });
}
  chrome.storage.local.set({ lastSummary: saveResult.summary, lastPrompt: saveResult.prompt || '' });
}
const summaryText = document.getElementById('summaryText');
const promptBox = document.getElementById('promptBox');
const copyPromptBtn = document.getElementById('btnCopyPrompt');

if (summaryArea && saveResult.summary) {
  summaryText.innerText = saveResult.summary;
  promptBox.innerText = saveResult.prompt || '(프롬프트 생성 실패. "이어서 시작" 버튼을 눌러보세요.)';
  summaryArea.style.display = 'block';  // 이미 block이어도 다시 설정 (안전)

  // storage에 저장 (팝업 재오픈 시 복원)
  chrome.storage.local.set({
    lastSummary: saveResult.summary,
    lastPrompt: saveResult.prompt || ''
  });

  // 복사 버튼 이벤트
  copyPromptBtn.onclick = () => {
    navigator.clipboard.writeText(promptBox.innerText);
    alert('✅ 프롬프트가 클립보드에 복사되었습니다.');
  };
} else {
  // fallback (이 경우는 거의 없음)
  if (saveResult.summary) showSummaryPopup(saveResult.summary);
}

incrementAndUpdateCount();
    setTimeout(() => { btn.textContent = '📸 지금 저장'; btn.disabled = false; }, 2000);
  } catch(e) {
    btn.textContent = '❌ 실패';
    alert('저장 실패: ' + e.message);
    setTimeout(() => { btn.textContent = '📸 지금 저장'; btn.disabled = false; }, 3000);
  }
}

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
      const btn = newBtn;
      btn.disabled = true;
      btn.textContent = '⏳ 저장...';
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'MANUAL_SNAPSHOT',
          data: { text, title: document.getElementById('manualTitle')?.value || '수동 입력' }
        }, (response) => {
          if (chrome.runtime.lastError) resolve({ error: chrome.runtime.lastError.message });
          else resolve(response || {});
        });
      });
      if (result?.error) alert(`실패: ${result.error}`);
      else {
        alert('✅ 저장 완료');
        document.getElementById('manualText').value = '';
        incrementAndUpdateCount();
        // 수동 저장도 하단 영역 표시
        const summaryArea = document.getElementById('summaryArea');
        if (summaryArea && result.summary) {
          document.getElementById('summaryText').innerText = result.summary;
          const promptBox = document.getElementById('promptBox');
          promptBox.innerText = result.prompt || '(프롬프트 없음)';
          summaryArea.style.display = 'block';
          document.getElementById('btnCopyPrompt').onclick = () => {
            navigator.clipboard.writeText(promptBox.innerText);
            alert('✅ 프롬프트 복사 완료');
          };
        } else if (result.summary) {
          showSummaryPopup(result.summary);
        }
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

// ========== 6. 탭 전환 ==========
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
    });
  });
}

// ========== 7. 메시지 전송 ==========
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

// ========== 8. 임시 요약 팝업 (fallback) ==========
function showSummaryPopup(summary) {
  const existingDiv = document.getElementById('summaryDisplay');
  if (existingDiv) existingDiv.remove();
  const summaryDiv = document.createElement('div');
  summaryDiv.id = 'summaryDisplay';
  summaryDiv.style.cssText = `margin-top:12px; padding:12px; background:var(--bg2); border-radius:var(--radius); border-left:3px solid var(--accent2); font-size:12px;`;
  summaryDiv.innerHTML = `
    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
      <span style="font-weight:700; color:var(--accent2);">✨ Gemini 요약</span>
      <button id="closeSummaryBtn" style="background:none; border:none; color:var(--text3); cursor:pointer;">✕</button>
    </div>
    <div style="color:var(--text); line-height:1.5;">${escapeHtml(summary)}</div>
  `;
  const saveBtn = document.getElementById('btnSaveNow');
  if (saveBtn && saveBtn.parentNode) saveBtn.insertAdjacentElement('afterend', summaryDiv);
  else document.getElementById('tab-action')?.appendChild(summaryDiv);
  document.getElementById('closeSummaryBtn')?.addEventListener('click', () => summaryDiv.remove());
  setTimeout(() => { if (summaryDiv.parentNode) summaryDiv.remove(); }, 10000);
}

function escapeHtml(text) {
  if (!text) return '';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ========== 9. 이어가기 프롬프트 생성 (HajunCore InjectLayer v0.2) ==========
async function generateContinuePrompt() {
  const btn = document.getElementById('btnInjectContinue') || document.getElementById('btnContinueContext');
  if (btn) {
    btn.disabled = true;
    btn.textContent = '⏳ HajunAI 맥락 분석 중...';
  }

  try {
    const { supabaseUrl, supabaseKey } = await getSupabaseCredentials();
    if (!supabaseUrl || !supabaseKey) {
      alert('⚠️ Supabase 설정이 필요합니다.');
      return;
    }

    const res = await fetch(`${supabaseUrl}/rest/v1/contexts?order=updated_at.desc&limit=1`, {
      headers: { 'apikey': supabaseKey, 'Authorization': `Bearer ${supabaseKey}` }
    });

    if (!res.ok) throw new Error('contexts 로드 실패');

    const contexts = await res.json();
    const latest = contexts[0] || {};

// HajunCore InjectLayer 호출 부분 (generateContinuePrompt 함수 안)
const injectCtx = {
  lastTask: latest.last_task || 'HajunAI 작업 진행 중',
  summary: latest.summary || '',
  nextAction: latest.next_action || '',
  currentProblems: latest.current_problems || '',
  recentConversations: latest.recent_summary ? [latest.recent_summary] : [],
  action: 'inject'
};

const result = InjectLayer(injectCtx);

    if (result._error) throw new Error(result._error);

    if (result.injectionPrompt) {
      await navigator.clipboard.writeText(result.injectionPrompt);
      
      alert('✅ HajunAI 강력 맥락 주입 프롬프트가 복사되었습니다!\n\nAI 채팅창에 바로 붙여넣으세요.');

      // UI 업데이트
      const promptBox = document.getElementById('promptBox');
      const summaryArea = document.getElementById('summaryArea');
      if (promptBox && summaryArea) {
        promptBox.innerText = result.injectionPrompt.length > 700 
          ? result.injectionPrompt.substring(0, 700) + '...' 
          : result.injectionPrompt;
        summaryArea.style.display = 'block';
      }
    }

  } catch (e) {
    console.error(e);
    alert(`❌ 맥락 주입 실패: ${e.message}`);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = '💉 "어제 이어서" 프롬프트 생성';
    }
  }
}

// ========== 10. 초기화 ==========
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initSettings();
  initSnapshotEvents();

  document.getElementById('btnRefreshHealth')?.addEventListener('click', runHealthCheck);
  
  const continueBtn = document.getElementById('btnContinueContext');
  if (continueBtn) continueBtn.addEventListener('click', generateContinuePrompt);

  runHealthCheck();
  scanAITabs();
  updateSnapshotCountDisplay();

  chrome.storage.local.get(['lastSummary', 'lastPrompt'], (result) => {
    if (result.lastSummary) {
      document.getElementById('summaryText').innerText = result.lastSummary;
      document.getElementById('promptBox').innerText = result.lastPrompt || '(저장된 프롬프트 없음)';
      document.getElementById('summaryArea').style.display = 'block';
    }
    // 복사 버튼 이벤트 (저장된 프롬프트가 있을 경우)
const copyBtn = document.getElementById('btnCopyPrompt');
if (copyBtn) {
  const newCopyBtn = copyBtn.cloneNode(true);
  copyBtn.parentNode.replaceChild(newCopyBtn, copyBtn);
  newCopyBtn.addEventListener('click', () => {
    const promptText = document.getElementById('promptBox')?.innerText || '';
    if (promptText) {
      navigator.clipboard.writeText(promptText);
      alert('✅ 프롬프트 복사됨');
    } else {
      alert('❌ 프롬프트 없음');
    }
  });
}
  });
});






async function saveCurrentConversation() {
  const btn = document.getElementById("btnSaveNow");
  if (!btn) return;

  if (currentTabs.length === 0) {
    alert("저장할 AI 탭이 없습니다.\nAI 탭을 열어주세요.");
    return;
  }

  const tab = currentTabs[0];
  btn.disabled = true;
  btn.textContent = "⏳ HajunCore 저장 중...";

  try {
    let result;
    try {
      const ping = await chrome.tabs.sendMessage(tab.id, { type: "PING" });
      if (ping === "pong") {
        result = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONVERSATION" });
      } else throw new Error("Ping failed");
    } catch(e) {
      const injectResult = await sendMessageToBg({ type: "INJECT_CONTENT_SCRIPT", tabId: tab.id });
      if (!injectResult?.success) throw new Error("content.js 주입 실패");
      await new Promise(r => setTimeout(r, 500));
      result = await chrome.tabs.sendMessage(tab.id, { type: "EXTRACT_CONVERSATION" });
    }

    if (result?.error) throw new Error(result.error);
    if (!result?.text) throw new Error("대화 내용 없음");

    // ==================== HajunCore SnapshotLayer 호출 ====================
    const saveResult = await sendMessageToBg({
      type: "MANUAL_SNAPSHOT",
      data: { 
        text: result.text, 
        title: result.title || getAIName(tab.url), 
        url: result.url, 
        ai: result.ai 
      }
    });

    if (saveResult?.error) throw new Error(saveResult.error);

    btn.textContent = "✅ 저장 완료!";

    // ==================== InjectLayer로 바로 주입 프롬프트 생성 ====================
    if (InjectLayer) {
      const injectCtx = {
        lastTask: saveResult.lastTask || "최근 작업",
        summary: saveResult.summary || "",
        recentConversations: [result.text.substring(0, 200) + "..."]
      };

      const injectResult = await InjectLayer(injectCtx);

      if (injectResult.injectionPrompt) {
        const promptBox = document.getElementById("promptBox");
        const summaryArea = document.getElementById("summaryArea");
        if (promptBox && summaryArea) {
          promptBox.innerText = injectResult.injectionPrompt.length > 600 
            ? injectResult.injectionPrompt.substring(0, 600) + "..." 
            : injectResult.injectionPrompt;
          summaryArea.style.display = "block";
        }
      }
    }

    incrementAndUpdateCount();

  } catch (e) {
    console.error(e);
    btn.textContent = "❌ 실패";
    alert("저장 실패: " + e.message);
  } finally {
    setTimeout(() => { 
      btn.textContent = "📸 지금 저장"; 
      btn.disabled = false; 
    }, 1500);
  }
}
