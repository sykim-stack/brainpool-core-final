// content.js — BRAINPOOL Core v6.1
// 원문 저장과 주입용 미리보기를 분리한다. 원문은 여기서 자르지 않는다.
console.log('[BRAINPOOL] content.js v6.1 로드됨:', location.hostname);

const AI_SELECTORS = {
  'claude.ai': {
    name: 'Claude',
    userMessages: '[data-testid="user-message"], [data-testid*="user-message"], [class*="font-user-message"]',
    assistantMessages: '[data-testid="assistant-message"], [data-testid*="assistant-message"], [data-testid*="response"], [class*="font-claude-response-body"], [class*="font-claude-response"], [class*="prose"]',
  },
  'chatgpt.com': {
    name: 'ChatGPT', messages: '[data-message-id], [data-testid*="conversation-turn"]',
    roleAttrs: ['data-author-role', 'data-message-author-role'], text: '[class*="prose"], [data-message-content]',
  },
  'chat.openai.com': {
    name: 'ChatGPT', messages: '[data-message-id], [data-testid*="conversation-turn"]',
    roleAttrs: ['data-author-role', 'data-message-author-role'], text: '[class*="prose"], [data-message-content]',
  },
  'gemini.google.com': {
    name: 'Gemini', userMessages: '.query-text, [class*="user-query"], .user-query-text',
    assistantMessages: 'model-response, [class*="response-content"], [class*="model-response"]',
    shadowRoot: true, text: '.response-content, p',
  },
  'www.perplexity.ai': {
    name: 'Perplexity', userMessages: '[class*="query"]',
    assistantMessages: '[class*="prose"], [class*="answer"], [class*="response"]',
  },
};

function clean(value) {
  return String(value || '').replace(/\u00a0/g, ' ').replace(/[ \t]+\n/g, '\n').trim();
}

function uniqueNodes(nodes) {
  const candidates = [...nodes].filter((el) => clean(el.innerText).length > 5)
    .sort((a, b) => clean(b.innerText).length - clean(a.innerText).length);
  const kept = [];
  for (const node of candidates) {
    const text = clean(node.innerText);
    if (!kept.some((other) => other.contains(node) || clean(other.innerText) === text)) kept.push(node);
  }
  return kept;
}

function extractClaudeLike(config) {
  const users = uniqueNodes(document.querySelectorAll(config.userMessages));
  const assistants = uniqueNodes(document.querySelectorAll(config.assistantMessages));
  const rows = [];
  for (const el of users) rows.push({ role: 'user', content: clean(el.innerText), ai_source: config.name, _el: el });
  for (const el of assistants) {
    const content = config.shadowRoot && el.shadowRoot
      ? clean(el.shadowRoot.querySelector(config.text)?.innerText || el.shadowRoot.innerText)
      : clean(config.text ? el.querySelector(config.text)?.innerText || el.innerText : el.innerText);
    if (content.length > 5) rows.push({ role: 'assistant', content, ai_source: config.name, _el: el });
  }
  rows.sort((a, b) => a._el.compareDocumentPosition(b._el) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  return rows;
}

function extractConversation() {
  const config = AI_SELECTORS[location.hostname];
  if (!config) return { error: `지원하지 않는 사이트: ${location.hostname}` };
  let messages = [];
  if (config.roleAttrs) {
    document.querySelectorAll(config.messages).forEach((el) => {
      const role = config.roleAttrs.map((attr) => el.getAttribute(attr)).find(Boolean);
      if (!role) return;
      const textEl = config.text ? el.querySelector(config.text) : el;
      const content = clean(textEl?.innerText);
      if (content.length > 5) messages.push({ role, content, ai_source: config.name, _el: el });
    });
  } else {
    messages = extractClaudeLike(config);
  }
  if (messages.length === 0) {
    const main = document.querySelector('main, [role="main"]');
    const mainText = clean(main?.innerText);
    if (mainText.length > 20) messages.push({ role: 'conversation', content: mainText, ai_source: config.name, _el: main });
  }
  if (messages.length === 0) return { error: '메시지를 찾을 수 없음' };

  const data = messages.map(({ role, content, ai_source }) => ({ role, content, ai_source }));
  const userCount = data.filter((m) => m.role === 'user').length;
  const assistantCount = data.filter((m) => ['assistant', 'model'].includes(m.role)).length;
  const warnings = [];
  if (config.name === 'Claude' && assistantCount === 0) warnings.push('Claude AI 답변을 찾지 못했습니다. 화면을 끝까지 로드한 뒤 다시 추출하세요.');
  if (config.name === 'Claude' && userCount === 0) warnings.push('Claude 사용자 메시지를 찾지 못했습니다.');
  return {
    ai: config.name, url: location.href, title: document.title,
    // 저장 원문: substring/slice를 적용하지 않는다.
    text: data.map((m) => `${m.role === 'user' ? '사용자' : 'AI'}: ${m.content}`).join('\n---\n'),
    data, messageCount: data.length, userCount, assistantCount, warnings,
    extractedAt: new Date().toISOString(),
  };
}

function findComposer() {
  const selectors = [
    'textarea[placeholder*="메시지"]', 'textarea[placeholder*="Message"]', 'textarea[placeholder*="Send"]',
    '[contenteditable="true"][role="textbox"]', '[contenteditable="true"][data-placeholder]',
    'textarea', '[contenteditable="true"]',
  ];
  return selectors.map(s => document.querySelector(s)).find(Boolean) || null;
}

function injectIntoComposer(text) {
  const composer = findComposer();
  if (!composer) return { success: false, error: '외부 AI 입력창을 찾지 못했습니다. 대화 화면을 열어주세요.' };
  composer.focus();
  if (composer.matches('textarea, input')) {
    const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
    if (setter) setter.call(composer, text); else composer.value = text;
    composer.dispatchEvent(new Event('input', { bubbles: true }));
    composer.dispatchEvent(new Event('change', { bubbles: true }));
  } else {
    composer.textContent = text;
    composer.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: text }));
  }
  return { success: true };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.type === 'PING') { sendResponse('pong'); return true; }
  if (msg.type === 'EXTRACT_CONVERSATION') { sendResponse(extractConversation()); return true; }
  if (msg.type === 'INJECT_HAJUN_CONTEXT') { sendResponse(injectIntoComposer(msg.text || '')); return true; }
  return false;
});
chrome.runtime.sendMessage({ type: 'CONTENT_SCRIPT_READY', host: location.hostname, url: location.href }).catch(() => {});
