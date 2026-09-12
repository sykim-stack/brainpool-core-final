// BRAINPOOL Core Extension — 최종 통합 popup.js
// 기능: AI 탭 감지 + 저장 + 요약/프롬프트 표시 + Action Engine + 이어가기 프롬프트 복사
// HajunCore import (Chrome Extension 환경)

// ========== HajunCore 로드 (안전 버전) ==========
let InjectLayer = null;

async function loadHajunCore() {
  try {
    const module = await import(chrome.runtime.getURL('src/hajuncore/index.js'));
    InjectLayer = module.InjectLayer;
    console.log("[popup] ✅ HajunCore InjectLayer 로드 성공");
  } catch (e) {
    console.error("[popup] ❌ HajunCore 로드 실패", e);
  }
}

// DOMContentLoaded 전에 호출
loadHajunCore();

// ========== 1. 공통 유틸리티 ==========
function getSupabaseCredentials() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['supabaseUrl', 'supabaseKey'], (result) => resolve(result));
  });
}

// ========== 2. 상태 체크 (하준아이 master 연결) ==========
async function runHealthCheck() {
  const resultsContainer = document.getElementById('healthResults');
  const lastCheckEl = document.getElementById('lastCheckTime');
  if (!resultsContainer) return;

  resultsContainer.innerHTML = '<div class="loading-state">🩺 하준아이 master 연결 확인 중...</div>';

  try {
    const result = await sendMessageToBg({ type: 'GET_HAJUN_SPACES' });
    if (result?.error || result?.success === false) throw new Error(result.error || '하준아이 master 연결 실패');
    const yardCount = (result.yards || []).length;
    const roomCount = (result.yards || []).reduce((sum, yard) => sum + (yard.rooms || []).length, 0);
    resultsContainer.innerHTML = `<div class="record-card" style="border-left:4px solid #3FB950"><span class="record-project">🟢 하준아이 master 연결 정상</span><div style="font-size:11px;color:var(--text2);margin-top:6px;">마당 ${yardCount}개 · 방 ${roomCount}개 · Message 전송 가능</div></div>`;
    if (lastCheckEl) lastCheckEl.textContent = new Date().toLocaleTimeString();
  } catch (e) {
    resultsContainer.innerHTML = `<div class="empty">⚠️ 하준아이 연결 오류: ${e.message}<br><span style="font-size:11px;">확장 프로그램을 새로고침한 뒤 다시 확인하세요.</span></div>`;
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
    const actionContainer = document.getElementById('actionEngineContainer');
    if (actionContainer) actionContainer.innerHTML = '<div class="record-card" style="border-left: 4px solid var(--text3);"><div style="font-size: 12px; color: var(--text2);">하준아이 Message를 저장하면 이 공간에 표시됩니다.</div></div>';
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
    const activeTabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const activeAiTabs = activeTabs.filter(tab => tab.url && aiSites.some(site => tab.url.includes(site)));
    currentTabs = [...activeAiTabs, ...aiTabs.filter(tab => !activeAiTabs.some(active => active.id === tab.id))];
    if (currentTabs.length === 0) {
      listEl.innerHTML = `<div class="ai-item"><span class="ai-name">감지된 AI 없음</span><span class="ai-status">대기</span></div>
        <div style="font-size:11px; margin-top:8px;">💡 Claude/ChatGPT/Gemini/Perplexity 탭을 열고 새로고침하세요</div>`;
      if (saveBtn) saveBtn.disabled = true;
      return;
    }
    listEl.innerHTML = currentTabs.map(tab => `
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

let hajunSpaces = [];

async function loadHajunSpaces() {
  const yardSelect = document.getElementById('hajunYardSelect');
  const roomSelect = document.getElementById('hajunRoomSelect');
  const status = document.getElementById('hajunSpaceStatus');
  if (!yardSelect || !roomSelect) return;
  const result = await sendMessageToBg({ type: 'GET_HAJUN_SPACES' });
  if (result?.error || result?.success === false) {
    yardSelect.innerHTML = '<option value="">마당 조회 실패</option>';
    roomSelect.innerHTML = '<option value="">하준아이 연결을 확인하세요</option>';
    if (status) status.textContent = `⚠ ${result.error || '공간 조회 실패'}`;
    return;
  }
  hajunSpaces = result.yards || [];
  const saved = await new Promise(resolve => chrome.storage.local.get(['selectedHajunSpace'], resolve));
  const savedSpace = saved.selectedHajunSpace || {};
  yardSelect.innerHTML = '<option value="">마당 선택</option>' + hajunSpaces.map(y => `<option value="${y.key}">${y.name}</option>`).join('');
  yardSelect.value = savedSpace.yard_key || '';
  const populateRooms = () => {
    const yard = hajunSpaces.find(y => y.key === yardSelect.value);
    roomSelect.innerHTML = yard
      ? '<option value="">방 선택</option>' + (yard.rooms || []).map(r => `<option value="${r.key}">${r.name}</option>`).join('')
      : '<option value="">마당을 먼저 선택하세요</option>';
    roomSelect.value = savedSpace.room_key || '';
  };
  populateRooms();
  if (status) status.textContent = '하준아이 master 연결됨 · 마당과 방을 선택하세요.';
  yardSelect.onchange = async () => { populateRooms(); await persistSelectedHajunSpace(); await refreshRecommendationOptions(); };
  roomSelect.onchange = async () => { await persistSelectedHajunSpace(); await refreshRecommendationOptions(); };
  document.getElementById('hajunMsgTypeSelect').onchange = persistSelectedHajunSpace;
  document.getElementById('hajunAuthorName').oninput = persistSelectedHajunSpace;
  await refreshRecommendationOptions();
}

async function refreshRecommendationOptions() {
  const select = document.getElementById('hajunRecommendationSelect');
  if (!select) return;
  const space = getSelectedHajunSpace();
  if (space.room_key !== 'product_discovery') {
    select.innerHTML = '<option value="">상품발굴방을 선택하면 추천을 연결할 수 있습니다</option>';
    return;
  }
  const yard = hajunSpaces.find((item) => item.key === space.yard_key);
  const room = (yard?.rooms || []).find((item) => item.key === space.room_key);
  if (!room) return;
  const result = await sendMessageToBg({ type: 'GET_HAJUN_RECOMMENDATIONS', roomId: room.id });
  const recommendations = result?.recommendations || [];
  select.innerHTML = '<option value="">연결할 AI 추천 선택 (선택사항)</option>' + recommendations.map((message) => {
    const text = String(message.content || '').replace(/\s+/g, ' ').slice(0, 70);
    return `<option value="${message.id}">${text || 'AI 추천'} · ${new Date(message.created_at || Date.now()).toLocaleDateString()}</option>`;
  }).join('');
}

function persistSelectedHajunSpace() {
  const selected = getSelectedHajunSpace();
  const status = document.getElementById('hajunSpaceStatus');
  if (!selected.yard_key || !selected.room_key) {
    if (status) status.textContent = '마당과 방을 모두 선택해야 저장할 수 있습니다.';
    return Promise.resolve(false);
  }
  if (status) status.textContent = '선택 공간 저장 중...';
  return new Promise((resolve) => {
    chrome.storage.local.set({ selectedHajunSpace: selected }, () => {
      if (chrome.runtime.lastError) {
        if (status) status.textContent = `⚠ 선택 공간 저장 실패: ${chrome.runtime.lastError.message}`;
        resolve(false);
        return;
      }
      chrome.storage.local.get(['selectedHajunSpace'], (result) => {
        const saved = result.selectedHajunSpace || {};
        const verified = saved.yard_key === selected.yard_key && saved.room_key === selected.room_key;
        if (status) status.textContent = verified
          ? '선택 공간 저장됨 · 팝업을 닫아도 유지됩니다.'
          : '⚠ 저장 확인 실패 · 확장 프로그램을 새로고침하세요.';
        resolve(verified);
      });
    });
  });
}

function getSelectedHajunSpace() {
  return {
    yard_key: document.getElementById('hajunYardSelect')?.value || '',
    room_key: document.getElementById('hajunRoomSelect')?.value || '',
    msg_type: document.getElementById('hajunMsgTypeSelect')?.value || 'work_result',
    author_name: document.getElementById('hajunAuthorName')?.value.trim() || '외부 AI',
    recommendation_message_id: document.getElementById('hajunRecommendationSelect')?.value || ''
  };
}

async function captureActiveProduct() {
  const btn = document.getElementById('btnCaptureProduct');
  const status = document.getElementById('productCaptureStatus');
  if (!btn || !status) return;
  const space = getSelectedHajunSpace();
  if (!space.yard_key || !space.room_key) {
    status.textContent = '먼저 상품검증마당과 상품발굴방을 선택해주세요.';
    return;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    status.textContent = '현재 탭을 찾을 수 없습니다.';
    return;
  }
  btn.disabled = true;
  btn.textContent = '캡처 중...';
  status.textContent = '현재 페이지의 상품 원문을 읽는 중입니다.';
  try {
    const result = await sendMessageToBg({ type: 'CAPTURE_ACTIVE_PRODUCT', tabId: tab.id, data: space });
    if (!result?.success) throw new Error(result?.error || '상품 캡처 실패');
    const product = result.extracted || {};
    const statusText = result.duplicate
      ? `기존 후보 사용\n${product.internal_code || result.message_id}`
      : `${product.entity_type === 'market_research' ? '시장조사 저장 완료' : '저장 완료'}\n${product.internal_code || ''}\nMessage ID: ${result.message_id || '없음'}`;
    status.textContent = statusText;
    chrome.storage.local.set({ lastProductCaptureStatus: { text: statusText, at: new Date().toISOString() } });
  } catch (error) {
    status.textContent = `저장 실패\n${error.message}`;
  } finally {
    btn.disabled = false;
    btn.textContent = '상품 원문 캡처';
  }
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
    const space = getSelectedHajunSpace();
    if (!space.yard_key || !space.room_key) throw new Error('먼저 하준아이 마당과 방을 선택해주세요.');
    const saveResult = await sendMessageToBg({
      type: 'POST_HAJUN_MESSAGE',
      data: { content: result.text, title: result.title || getAIName(tab.url), url: result.url, ai: result.ai, extractedAt: result.extractedAt, ...space }
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
      const space = getSelectedHajunSpace();
      if (!space.yard_key || !space.room_key) { alert('먼저 하준아이 마당과 방을 선택해주세요.'); return; }
      const btn = newBtn;
      btn.disabled = true;
      btn.textContent = '⏳ 저장...';
      const result = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          type: 'POST_HAJUN_MESSAGE',
          data: { content: text, title: document.getElementById('manualTitle')?.value || '수동 입력', ai: 'manual', ...space }
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

// [하준아이 역방향 주입 2026-09-08]
// URL 접근이 제한된 외부 AI에는 방 기록을 텍스트로 직접 입력한다.
async function injectSelectedRoomContext() {
  const btn = document.getElementById('btnInjectRoomContext');
  if (btn) { btn.disabled = true; btn.textContent = '⏳ 방 맥락 불러오는 중...'; }
  try {
    const space = getSelectedHajunSpace();
    if (!space.yard_key || !space.room_key) throw new Error('먼저 하준아이 마당과 방을 선택해주세요.');
    const tab = currentTabs[0];
    if (!tab?.id) throw new Error('Claude·ChatGPT·Gemini 등 외부 AI 탭을 먼저 열어주세요.');
    const result = await sendMessageToBg({
      type: 'INJECT_HAJUN_CONTEXT',
      tabId: tab.id,
      data: space,
    });
    if (!result?.success) throw new Error(result?.error || '맥락 주입 실패');
    const promptBox = document.getElementById('promptBox');
    const summaryArea = document.getElementById('summaryArea');
    if (promptBox && summaryArea) {
      promptBox.innerText = result.preview || '방 맥락이 입력창에 주입되었습니다.';
      summaryArea.style.display = 'block';
    }
    alert(`✅ ${result.messageCount || 0}개 방 기록을 외부 AI 입력창에 넣었습니다.\n내용을 확인한 뒤 직접 전송하세요.`);
  } catch (e) {
    alert(`❌ 방 맥락 주입 실패: ${e.message}`);
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = '📥 선택한 방 맥락을 외부 AI 입력창에 주입'; }
  }
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
  loadHajunSpaces();

  document.getElementById('btnRefreshHealth')?.addEventListener('click', runHealthCheck);
  
  const continueBtn = document.getElementById('btnContinueContext');
  if (continueBtn) continueBtn.addEventListener('click', generateContinuePrompt);
  const roomInjectBtn = document.getElementById('btnInjectRoomContext');
  if (roomInjectBtn) roomInjectBtn.addEventListener('click', injectSelectedRoomContext);
  const productCaptureBtn = document.getElementById('btnCaptureProduct');
  if (productCaptureBtn) productCaptureBtn.addEventListener('click', captureActiveProduct);
  const saveSpaceBtn = document.getElementById('btnSaveHajunSpace');
  if (saveSpaceBtn) saveSpaceBtn.addEventListener('click', () => {
    persistSelectedHajunSpace().then((saved) => {
      saveSpaceBtn.textContent = saved ? '✅ 선택 공간 저장됨' : '⚠ 저장 실패';
      setTimeout(() => { saveSpaceBtn.textContent = '💾 선택 공간 저장'; }, 1800);
    });
  });

  runHealthCheck();
  scanAITabs();
  updateSnapshotCountDisplay();

  chrome.storage.local.get(['lastSummary', 'lastPrompt', 'lastProductCaptureStatus'], (result) => {
    if (result.lastSummary) {
      document.getElementById('summaryText').innerText = result.lastSummary;
      document.getElementById('promptBox').innerText = result.lastPrompt || '(저장된 프롬프트 없음)';
      document.getElementById('summaryArea').style.display = 'block';
    }
    const productStatus = document.getElementById('productCaptureStatus');
    if (productStatus && result.lastProductCaptureStatus?.text) {
      const at = result.lastProductCaptureStatus.at ? new Date(result.lastProductCaptureStatus.at).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '';
      productStatus.textContent = `${result.lastProductCaptureStatus.text}${at ? `\n마지막 처리: ${at}` : ''}`;
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
    if (Array.isArray(result.warnings) && result.warnings.length > 0) {
      const warning = result.warnings.join('\n');
      if (!confirm(`추출 경고가 있습니다:\n\n${warning}\n\n현재 추출된 ${result.messageCount || 0}개 메시지만 저장할까요?`)) {
        throw new Error('추출 경고로 저장을 취소했습니다.');
      }
    }

    const space = getSelectedHajunSpace();
    if (!space.yard_key || !space.room_key) throw new Error('먼저 하준아이 마당과 방을 선택해주세요.');

    // ==================== HajunAI master Message API ====================
    const saveResult = await sendMessageToBg({
      type: "POST_HAJUN_MESSAGE",
      data: { 
        content: result.text,
        title: result.title || getAIName(tab.url), 
        url: result.url, 
        ai: result.ai || getAIName(tab.url),
        extractedAt: result.extractedAt,
        ...space
      }
    });

    if (saveResult?.error) throw new Error(saveResult.error);

    btn.textContent = "✅ 저장 완료!";

    // ==================== InjectLayer로 바로 주입 프롬프트 생성 ====================
    if (InjectLayer) {
      const injectCtx = {
        lastTask: saveResult.lastTask || "최근 작업",
        summary: saveResult.summary || "",
        // 원문 저장은 전체, 주입 엔진에 넘기는 보조 미리보기만 제한한다.
        recentConversations: [result.text.substring(0, 1200) + (result.text.length > 1200 ? "..." : "")]
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
