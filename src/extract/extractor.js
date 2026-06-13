// src/extract/extractor.js — 공개용 안정화 버전
export function extract(ctx) {
  const host = ctx.payload?.host || (typeof window !== 'undefined' ? window.location?.hostname : '');
  const selectors = ctx.SELECTORS || {};

  const config = selectors[host] || Object.values(selectors).find(s => 
    host.includes(s.name.toLowerCase())
  );

  if (!config) {
    ctx._error = `지원하지 않는 AI: ${host}`;
    return ctx;
  }

  try {
    let elements = [];
    const messageSelectors = Array.isArray(config.messages) ? config.messages : [config.messages];

    for (const sel of messageSelectors) {
      const found = document.querySelectorAll(sel);
      if (found.length > 2) {
        elements = Array.from(found);
        break;
      }
    }

    // Claude 백업 셀렉터
    if (elements.length === 0 && host.includes('claude')) {
      elements = document.querySelectorAll('article, div[role="article"], [class*="message"]');
    }

    const conversation = [];

    elements.forEach((msg) => {
      let textEl = config.text ? msg.querySelector(config.text) : msg;
      const text = (textEl ? textEl.innerText : msg.innerText || msg.textContent)?.trim();

      if (text && text.length > 15) {
        const isUser = /user|human|me/i.test(msg.className) || 
                      msg.getAttribute('data-role') === 'user';

        conversation.push({
          role: isUser ? 'user' : 'assistant',
          content: text,
          ai_source: config.name
        });
      }
    });

    ctx.payload = ctx.payload || {};
    ctx.payload.conversation = conversation;
    ctx.payload.ai_source = config.name;
    ctx.payload.messageCount = conversation.length;

    if (conversation.length === 0) {
      ctx._error = "대화 메시지를 찾지 못했습니다. 페이지가 완전히 로드되었는지 확인하세요.";
    }

    return ctx;
  } catch (e) {
    ctx._error = `추출 실패: ${e.message}`;
    return ctx;
  }
}