console.log("[HajunAI Background] HajunCore 연동 v0.3 - Content Script 안정화");

let HajunCore = null;
let InjectLayer = null;
let SnapshotLayer = null;
const HAJUNCORE_URL = 'https://hajuncore-app.vercel.app';

// Stub (임시)
HajunCore = (ctx = {}) => ({ traceId: "tr-" + Date.now(), projectId: ctx.projectId || "aaaaaaaa-0000-0000-0000-000000000001", _error: null, ...ctx });
InjectLayer = (ctx = {}) => { ctx = HajunCore(ctx); ctx.injectionPrompt = "🦈 맥락 주입 준비 완료 (Stub)"; return ctx; };
SnapshotLayer = async (ctx = {}) => { ctx = HajunCore(ctx); return ctx; };

console.log("[Background] ✅ HajunCore Stub 로드 완료");

// ==================== 메시지 핸들러 ====================
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log(`[Background] 메시지: ${msg.type}`);

  if (msg.type === 'POST_HAJUN_MESSAGE') {
    handleHajunMessage(msg.data).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'GET_HAJUN_SPACES') {
    getHajunSpaces().then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'INJECT_HAJUN_CONTEXT') {
    injectHajunContext(msg.tabId, msg.data).then(sendResponse).catch(e => sendResponse({ success: false, error: e.message }));
    return true;
  }

  if (msg.type === 'INJECT_CONTENT_SCRIPT') {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ['content.js']
    }).then(() => {
      sendResponse({ success: true });
    }).catch(err => {
      console.error("Content script injection failed:", err);
      sendResponse({ success: false, error: err.message });
    });
    return true;
  }

  sendResponse({ error: 'Unknown type' });
  return false;
});

async function hajunFetch(path, options = {}) {
  const response = await fetch(HAJUNCORE_URL + path, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) }
  });
  const text = await response.text();
  let data;
  try { data = text ? JSON.parse(text) : {}; } catch { data = { _error: text || 'JSON 응답 파싱 실패' }; }
  if (!response.ok) return { _error: `하준아이 API 오류 (${response.status}): ${text}` };
  return data;
}

async function getHajunSpaces() {
  const yards = await hajunFetch('/api/hajun?action=yard_list');
  if (yards._error) return { success: false, error: yards._error };
  const list = await Promise.all((yards.payload || []).map(async (yard) => {
    const rooms = await hajunFetch(`/api/hajun?action=room_list&yard=${encodeURIComponent(yard.key)}`);
    return { ...yard, rooms: rooms.payload?.rooms || [], error: rooms._error || null };
  }));
  return { success: true, yards: list };
}

function buildHajunContext({ yard, room, messages }) {
  const ordered = [...(messages || [])].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const important = ordered.filter(m => ['decision', 'issue', 'doc_injection'].includes(m.msg_type));
  const recent = ordered.slice(-12);
  const unique = new Map([...important, ...recent].map(m => [m.id || `${m.created_at}-${m.content}`, m]));
  const selected = [...unique.values()].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const lines = selected.map(m => `[${m.msg_type || 'message'}] ${m.author_name || '작성자'} (${m.created_at || '시각 없음'})\n${m.content || ''}`);
  return [
    '[BRAINPOOL HAJUNAI CONTEXT]',
    '아래 내용은 하준아이 방에서 명시적으로 불러온 작업 맥락입니다.',
    `마당: ${yard?.name || yard?.key || '알 수 없음'}`,
    `방: ${room?.name || room?.key || '알 수 없음'}`,
    '원칙: 원문 기록은 참고 자료이며, 사람 확인 전 AI 답변을 confirmed로 확정하지 않습니다.',
    '',
    '[방 기록]',
    lines.length ? lines.join('\n\n---\n\n') : '(아직 저장된 메시지가 없습니다.)',
    '',
    '[응답 지침]',
    '위 기록을 현재 작업의 맥락으로 사용하되, 기록에 없는 사실은 추측하지 말고 확인이 필요한 사항으로 표시하세요.',
  ].join('\n');
}

async function injectHajunContext(tabId, data = {}) {
  if (!tabId) return { success: false, error: '외부 AI 탭을 찾을 수 없습니다.' };
  if (!data.yard_key || !data.room_key) return { success: false, error: '먼저 하준아이 마당과 방을 선택해주세요.' };
  const rooms = await hajunFetch(`/api/hajun?action=room_list&yard=${encodeURIComponent(data.yard_key)}`);
  const yard = rooms.payload?.yard;
  const room = (rooms.payload?.rooms || []).find(r => r.key === data.room_key);
  if (!yard || !room) return { success: false, error: '선택한 하준아이 방을 찾을 수 없습니다.' };
  const view = await hajunFetch(`/api/hajun?action=view_room&room_id=${encodeURIComponent(room.id)}`);
  if (view._error) return { success: false, error: view._error };
  const context = buildHajunContext({ yard, room, messages: view.payload?.messages || [] });
  let injected;
  try {
    injected = await chrome.tabs.sendMessage(tabId, { type: 'INJECT_HAJUN_CONTEXT', text: context });
  } catch {
    await chrome.scripting.executeScript({ target: { tabId }, files: ['content.js'] });
    await new Promise(resolve => setTimeout(resolve, 250));
    injected = await chrome.tabs.sendMessage(tabId, { type: 'INJECT_HAJUN_CONTEXT', text: context });
  }
  if (!injected?.success) return { success: false, error: injected?.error || '외부 AI 입력창 주입 실패' };
  return { success: true, messageCount: view.payload?.messages?.length || 0, preview: context.slice(0, 1200) };
}

async function handleHajunMessage(data = {}) {
  const { yard_key, room_key, author_name, msg_type, content, ref_ids = [] } = data;
  if (!yard_key || !room_key) return { success: false, error: '마당과 방을 선택해주세요.' };
  if (!content || !String(content).trim()) return { success: false, error: '저장할 대화 내용이 없습니다.' };

  const source = data.ai ? `[출처: ${data.ai}]\n` : '';
  const title = data.title ? `[제목: ${data.title}]\n` : '';
  const url = data.url ? `[URL: ${data.url}]\n` : '';
  const extractedAt = data.extractedAt ? `[추출시각: ${data.extractedAt}]\n` : '';
  const result = await hajunFetch('/api/hajun?action=post_message', {
    method: 'POST',
    body: JSON.stringify({
      yard_key, room_key, author_type: 'human',
      author_name: author_name || data.ai || '외부 AI',
      msg_type: msg_type || 'work_result',
      content: `${source}${title}${url}${extractedAt}\n${String(content).trim()}`,
      ref_ids: Array.isArray(ref_ids) ? ref_ids : []
    })
  });
  if (result._error) return { success: false, error: result._error };
  return { success: true, payload: result.payload || null, summary: `${yard_key}/${room_key}에 Message 저장 완료` };
}
