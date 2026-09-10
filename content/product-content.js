// BRAINPOOL 상품검증 MVP — 사용자가 현재 페이지에서 캡처 버튼을 눌렀을 때만 실행
(function () {
  if (window.__BRAINPOOL_PRODUCT_CONTENT_LOADED) return;
  window.__BRAINPOOL_PRODUCT_CONTENT_LOADED = true;

  function clean(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
  }

  function hostname() {
    return location.hostname.toLowerCase();
  }

  function isNaverPage() {
    return hostname().endsWith('naver.com') || hostname().endsWith('naver.net');
  }

  function isOnChannelPage() {
    return hostname().includes('onch3.co.kr') || hostname().includes('onchannel.co.kr');
  }

  function extractOnChannelCode(text) {
    const match = text.match(/\b(CH\d{5,})\b/i);
    return match ? match[1].toUpperCase() : '';
  }

  function extractNaverCode() {
    const url = new URL(location.href);
    const queryCode = url.searchParams.get('nv_mid') || url.searchParams.get('productNo');
    if (queryCode && /^\d{4,}$/.test(queryCode)) return queryCode;
    const pathMatch = url.pathname.match(/\/products\/(\d{4,})/i) || url.pathname.match(/\/(\d{6,})(?:\/|$)/);
    if (pathMatch) return pathMatch[1];
    const body = document.body?.innerText || '';
    const labelMatch = body.match(/(?:상품번호|상품 ID|productNo)\s*[:：]?\s*(\d{4,})/i);
    if (labelMatch) return labelMatch[1];
    const query = clean(url.searchParams.get('query') || url.searchParams.get('q') || '');
    return query ? `search:${query.toLowerCase()}` : '';
  }

  function extractName() {
    const candidates = [
      document.querySelector('h1')?.innerText,
      document.querySelector('[class*="product_name"]')?.innerText,
      document.querySelector('[class*="goods_name"]')?.innerText,
      document.querySelector('[class*="商品名"]')?.innerText,
      document.querySelector('meta[property="og:title"]')?.content,
      document.title
    ].map(clean).filter(Boolean);
    return candidates[0] || '';
  }

  function extractPrices(text) {
    return [...text.matchAll(/(?:판매가|최저가|가격|할인가|정가|혜택가)?\s*[:：]?\s*([\d,]{3,})\s*원/g)]
      .map((match) => Number(match[1].replace(/,/g, '')))
      .filter((value) => Number.isFinite(value) && value > 0)
      .filter((value, index, values) => values.indexOf(value) === index)
      .slice(0, 20);
  }

  function extractReviews(text) {
    const reviewMatch = text.match(/(?:리뷰|후기|상품평)\s*([\d,]+)\s*(?:개|건)?/i);
    const ratingMatch = text.match(/(?:평점|별점|rating)\s*([0-5](?:\.\d)?)/i);
    return {
      count: reviewMatch ? Number(reviewMatch[1].replace(/,/g, '')) : null,
      rating: ratingMatch ? Number(ratingMatch[1]) : null
    };
  }

  function extractKeywords(text) {
    const fromHash = [...text.matchAll(/(^|\s)#([^\s#]{1,40})/g)].map((match) => match[2]);
    const fromMeta = clean(document.querySelector('meta[name="keywords"]')?.content || '')
      .split(/[,|]/).map(clean).filter(Boolean);
    const query = new URL(location.href).searchParams.get('query') || new URL(location.href).searchParams.get('q') || '';
    return [...new Set([...fromHash, ...fromMeta, clean(query)].filter(Boolean))].slice(0, 40);
  }

  function extractOnChannel() {
    const rawText = (document.body?.innerText || '').trim();
    if (!rawText) return { error: '페이지 원문을 읽을 수 없습니다.' };
    const sourceProductCode = extractOnChannelCode(`${location.href}\n${rawText}`);
    if (!sourceProductCode) return { error: '온채널 상품코드(CH로 시작하는 코드)를 찾지 못했습니다.' };
    const capturedAt = new Date().toISOString();
    const prices = extractPrices(rawText);
    return {
      entity_type: 'product_candidate',
      msg_type: 'doc_injection',
      source: 'onchannel',
      source_product_code: sourceProductCode,
      internal_code: `onchannel:${sourceProductCode}`,
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

  function extractNaver() {
    const rawText = (document.body?.innerText || '').trim();
    if (!rawText) return { error: '네이버 페이지 원문을 읽을 수 없습니다.' };
    const sourceProductCode = extractNaverCode();
    if (!sourceProductCode) return { error: '네이버 상품번호 또는 검색어를 찾지 못했습니다.' };
    const capturedAt = new Date().toISOString();
    const reviews = extractReviews(rawText);
    const keywords = extractKeywords(rawText);
    const prices = extractPrices(rawText);
    const name = extractName();
    return {
      entity_type: 'market_research',
      msg_type: 'work_result',
      source: 'naver',
      source_product_code: sourceProductCode,
      internal_code: `naver:${sourceProductCode}`,
      name,
      source_url: location.href,
      captured_at: capturedAt,
      image_url: document.querySelector('meta[property="og:image"]')?.content || document.querySelector('img')?.currentSrc || '',
      prices,
      reviews,
      keywords,
      search_query: new URL(location.href).searchParams.get('query') || new URL(location.href).searchParams.get('q') || '',
      content: rawText.slice(0, 20000),
      truncated: rawText.length > 20000,
      title: document.title
    };
  }

  function extract() {
    if (isNaverPage()) return extractNaver();
    if (isOnChannelPage()) return extractOnChannel();
    return { error: '온채널 또는 네이버 상품·검색 페이지에서만 상품 캡처를 실행할 수 있습니다.' };
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== 'EXTRACT_PRODUCT') return false;
    sendResponse(extract());
    return true;
  });

  chrome.runtime.sendMessage({ type: 'PRODUCT_CONTENT_READY', url: location.href }).catch(() => {});
})();
