// content.js — BRAINPOOL Core v6.0 (conversation 배열 반환)
console.log('[BRAINPOOL] content.js v6.0 로드됨:', location.hostname);

const AI_SELECTORS = {
  'claude.ai': {
    name: 'Claude',
    userMessages: '[class*="font-user-message"]',
    assistantMessages: '[class*="font-claude-response-body"]'
  },
  'chatgpt.com': {
    name: 'ChatGPT',
    messages: '[data-message-id]',
    roleAttr: 'data-author-role',
    text: '[class*="prose"]'
  },
  'chat.openai.com': {
    name: 'ChatGPT',
    messages: '[data-message-id]',
    roleAttr: 'data-author-role',
    text: '[class*="prose"]'
  },
  'gemini.google.com': {
    name: 'Gemini',
    userMessages: '.query-text, [class*="user-query"], .user-query-text',
    assistantMessages: 'model-response, [class*="response-content"]',
    shadowRoot: true,
    text: '.response-content, p'
  },
  'www.perplexity.ai': {
    name: 'Perplexity',
    userMessages: '[class*="query"]',
    assistantMessages: '[class*="prose"]'
  }
};

function extractConversation() {
  const host = location.hostname;
  const config = AI_SELECTORS[host];
  if (!config) return { error: `지원하지 않는 사이트: ${host}` };

  const messages = [];

  // ChatGPT: roleAttr 방식
  if (config.roleAttr) {
    document.querySelectorAll(config.messages).forEach(el => {
      const role = el.getAttribute(config.roleAttr);
      if (!role) return;
      const textEl = config.text ? el.querySelector(config.text) : el;
      const content = textEl?.innerText?.trim();
      if (content && content.length > 5)
        messages.push({ role, content, ai_source: config.name });
    });
  }

  // Claude, Gemini, Perplexity: user/assistant 분리 방식
  if (config.userMessages) {
    const userEls   = [...document.querySelectorAll(config.userMessages)];
    const assistEls = [...document.querySelectorAll(config.assistantMessages)];

    userEls.forEach(el => {
      const content = el.innerText?.trim();
      if (content && content.length > 5)
        messages.push({ role: 'user', content, ai_source: config.name, _el: el });
    });

    assistEls.forEach(el => {
      let content;
      if (config.shadowRoot && el.shadowRoot) {
        content = el.shadowRoot.querySelector(config.text)?.innerText?.trim()
               || el.shadowRoot.innerText?.trim();
      } else {
        content = config.text
          ? el.querySelector(config.text)?.innerText?.trim()
          : el.innerText?.trim();
      }
      if (content && content.length > 5)
        messages.push({ role: 'assistant', content, ai_source: config.name, _el: el });
    });

    // DOM 순서 정렬
    messages.sort((a, b) => {
      if (!a._el || !b._el) return 0;
      const pos = a._el.compareDocumentPosition(b._el);
      return pos & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1;
    });

    // BRAINPOOL 시스템 메시지 제거
const filtered = messages.filter(m => !isBrainpoolMessage(m.content));

if (filtered.length === 0) return { error: '실제 대화 내용 없음 (시스템 메시지만 존재)' };

return {
  ai: config.name,
  url: location.href,
  title: document.title,
  text: filtered.map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`).join('\n---\n'),
  data: filtered,
  messageCount: filtered.length,
  extractedAt: new Date().toISOString()
};


    messages.forEach(m => delete m._el);
  }

  if (messages.length === 0) return { error: '메시지를 찾을 수 없음' };

  return {
    ai: config.name,
    url: location.href,
    title: document.title,
    text: messages.map(m => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`).join('\n---\n'),
    data: messages,           // ← conversation 배열 (background.js에서 사용)
    messageCount: messages.length,
    extractedAt: new Date().toISOString()
  };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse('pong'); return true; }
  if (msg.type === 'EXTRACT_CONVERSATION') {
    sendResponse(extractConversation());
    return true;
  }
  return false;
});
const BRAINPOOL_PATTERNS = [
  'BRAINPOOL Core — 이전 대화를 이어갑니다',
  'BRAINPOOL — 이어서 작업',
  '📌 마지막 작업',
  '[마지막 작업]',
  '[현재 상황 요약]',
  '[지금 바로 할 것]',
  '🎯 다음 행동',
  '📝 간단 요약',
  '위 내용을 참고하여',
  '이전 맥락을 유지하며',
  '위 맥락을 기반으로',
  '🦁 BRAINPOOL',
  '🦈 BRAINPOOL',
];

function isBrainpoolMessage(content) {
  return BRAINPOOL_PATTERNS.some(p => content.includes(p));
}
chrome.runtime.sendMessage({
  type: 'CONTENT_SCRIPT_READY',
  host: location.hostname,
  url: location.href
}).catch(() => {});


