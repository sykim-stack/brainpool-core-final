// BRAINPOOL 상품검증 MVP — 사용자가 현재 페이지에서 캡처 버튼을 눌렀을 때만 실행
(function () {
  if (window.__BRAINPOOL_PRODUCT_CONTENT_LOADED) return;
  window.__BRAINPOOL_PRODUCT_CONTENT_LOADED = true;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function extractCode(text) {
    const match = text.match(/\b(CH\d{5,})\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  function extractName() {
    const candidates = [
      document.querySelector('h1')?.innerText,
      document.querySelector('[class*="product_name"]')?.innerText,
      document.querySelector('[class*="goods_name"]')?.innerText,
      document.title
    ].map(clean).filter(Boolean);
    return candidates[0] || '';
  }

  function extractPrices(text) {
    const prices = [...text.matchAll(/(?:공급가|판매가|가격|최저가)\s*[:：]?\s*([\d,]+)\s*원?/g)]
      .map((match) => Number(match[1].replace(/,/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0);
    return prices.slice(0, 10);
  }

  function extract() {
    const rawText = (document.body?.innerText || '').trim();
    if (!rawText) return { error: '페이지 원문을 읽을 수 없습니다.' };
    const source = location.hostname.includes('onch3.co.kr') ? 'onchannel' : location.hostname;
    const sourceProductCode = extractCode(`${location.href}\n${rawText}`);
    if (!sourceProductCode) {
      return { error: '온채널 상품코드(CH로 시작하는 코드)를 찾지 못했습니다.' };
    }
    const capturedAt = new Date().toISOString();
    const prices = extractPrices(rawText);
    return {
      source,
      source_product_code: sourceProductCode,
      internal_code: `${source}:${sourceProductCode}`,
      name: extractName(),
      source_url: location.href,
      captured_at: capturedAt,
      image_url: document.querySelector('img')?.currentSrc || document.querySelector('img')?.src || '',
      prices,
      content: rawText.slice(0, 20000),
      truncated: rawText.length > 20000,
      title: document.title
    };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_PRODUCT') return false;
    sendResponse(extract());
    return true;
  });

  chrome.runtime.sendMessage({ type: 'PRODUCT_CONTENT_READY', url: location.href }).catch(() => {});
})();
