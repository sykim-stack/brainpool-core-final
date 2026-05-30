// content.js v5.1.2 — AI 사이트 DOM 추출 + 안정성 강화
// 역할: DOM에서 대화 내용 추출 → background로 전달

const AI_SELECTORS = {
  'claude.ai': {
    name: 'Claude',
    messages: ['[class*="font-user-message"]', '[class*="font-claude-response-body"]'],
    text: null
  },
  'chatgpt.com': {
    name: 'ChatGPT',
    messages: ['[data-message-id]'],
    text: '[class*="prose"]'
  },
  'chat.openai.com': {
    name: 'ChatGPT',
    messages: ['[data-message-id]'],
    text: '[class*="prose"]'
  },
  'gemini.google.com': {
    name: 'Gemini',
    messages: ['model-response'],
    text: 'p'
  },
  'www.perplexity.ai': {
    name: 'Perplexity',
    messages: ['[class*="prose"]'],
    text: null
  }
};

function extractConversation() {
  try {
    const host = window.location.hostname;
    const selectorConfig = AI_SELECTORS[host];
    
    if (!selectorConfig) {
      return { error: `지원하지 않는 사이트: ${host}` };
    }

    // 여러 셀렉터 시도
    let elements = [];
    for (const selector of selectorConfig.messages) {
      const found = document.querySelectorAll(selector);
      if (found && found.length > 0) {
        elements = found;
        break;
      }
    }
    
    if (!elements || elements.length === 0) {
      return { error: `메시지 요소를 찾을 수 없음` };
    }

    const texts = Array.from(elements)
      .map(el => {
        if (selectorConfig.text) {
          const textEl = el.querySelector(selectorConfig.text);
          return textEl ? textEl.textContent : el.textContent;
        }
        return el.textContent;
      })
      .map(t => t?.trim())
      .filter(t => t && t.length > 0);

    if (!texts || texts.length === 0) {
      return { error: '추출된 텍스트가 없음' };
    }

    const combinedText = texts.join('\n---\n');

    return {
      ai: selectorConfig.name,
      url: window.location.href,
      title: document.title || selectorConfig.name,
      text: combinedText,
      extractedAt: new Date().toISOString(),
      host: host,
      messageCount: elements.length
    };
    
  } catch (e) {
    return { error: `extractConversation 실패: ${e.message}` };
  }
}

// 메시지 리스너
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // PING 요청 처리 (연결 확인용)
  if (msg.type === 'PING') {
    sendResponse('pong');
    return true;
  }
  
  if (msg.type === 'EXTRACT_CONVERSATION') {
    const result = extractConversation();
    sendResponse(result);
    return true;
  }
});

// 로드 완료 신호
try {
  chrome.runtime.sendMessage({ 
    type: 'CONTENT_SCRIPT_READY', 
    host: window.location.hostname,
    url: window.location.href
  }).catch(() => {});
} catch (e) {
  // 무시
}

// content.js v5.1.5 — 안정화 버전

console.log('[HajunAI] Content script 로드됨:', location.hostname);

// 셀렉터
console.log('[HajunAI] Content script v5.1.9 로드됨:', location.hostname);

// 셀렉터
const SELECTORS = {
  'claude.ai': {
    name: 'Claude',
    messages: ['.font-user-message', '.font-claude-response-body', '[class*="message"]']
  },
  'chatgpt.com': {
    name: 'ChatGPT',
    messages: ['[data-message-id]', '.group', '[class*="message"]']
  },
  'chat.openai.com': {
    name: 'ChatGPT',
    messages: ['[data-message-id]', '.group', '[class*="message"]']
  },
  'gemini.google.com': {
    name: 'Gemini',
    messages: ['model-response', '.message', '[class*="response"]']
  },
  'www.perplexity.ai': {
    name: 'Perplexity',
    messages: ['[class*="prose"]', '[class*="message"]']
  }
};

function extractConversation() {
  const host = location.hostname;
  const config = SELECTORS[host];
  
  if (!config) {
    return { error: `지원 안 함: ${host}` };
  }

  let elements = [];
  for (const sel of config.messages) {
    elements = document.querySelectorAll(sel);
    if (elements.length > 0) break;
  }

  if (elements.length === 0) {
    return { error: '메시지 없음' };
  }

  const texts = Array.from(elements)
    .map(el => el.innerText?.trim())
    .filter(t => t && t.length > 10);

  if (texts.length === 0) {
    return { error: '텍스트 없음' };
  }

  return {
    ai: config.name,
    url: location.href,
    title: document.title,
    text: texts.join('\n---\n'),
    extractedAt: new Date().toISOString(),
    messageCount: texts.length
  };
}

// 메시지 리스너 (PING 포함)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log('[content.js] 메시지 수신:', msg.type);
  
  if (msg.type === 'PING') {
    sendResponse('pong');
    return true;
  }
  
  if (msg.type === 'EXTRACT_CONVERSATION') {
    const result = extractConversation();
    sendResponse(result);
    return true;
  }
  
  return false;
});

// 로드 완료 신호
chrome.runtime.sendMessage({ 
  type: 'CONTENT_SCRIPT_READY', 
  host: location.hostname,
  url: location.href
}).catch(() => {});

console.log('[HajunAI] Content script ready, PING handler registered');