const SELECTORS = {
  'claude.ai': {
    name: 'Claude',
    messages: '[class*="font-user-message"], [class*="font-claude-response-body"]',
    text: null
  },
  'chatgpt.com': {
    name: 'ChatGPT',
    messages: '[data-message-id]',
    text: '[class*="prose"]'
  },
  'chat.openai.com': {
    name: 'ChatGPT',
    messages: '[data-message-id]',
    text: '[class*="prose"]'
  },
  'gemini.google.com': {
    name: 'Gemini',
    messages: 'model-response',
    text: 'p'
  },
  'www.perplexity.ai': {
    name: 'Perplexity',
    messages: '[class*="prose"]',
    text: null
  }
};

export default SELECTORS;
