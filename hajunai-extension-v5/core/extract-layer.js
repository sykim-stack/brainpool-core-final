// core/extract-layer.js — 모든 입력을 BRAINPOOL 표준 형식으로 변환
// 역할: AI별 DOM, 수동 입력, 향후 PDF/웹페이지 → 통일된 ctx.rawConversation

/**
 * ExtractLayer
 * 입력: 다양한 소스의 원본 데이터
 * 출력: 표준화된 ctx.rawConversation
 */
export function ExtractLayer(input) {
    const ctx = {
      rawConversation: null,
      meta: {},
      _error: null
    };
  
    try {
      // 소스별 분기
      switch (input.source) {
        case 'extension':
          ctx.rawConversation = normalizeExtension(input);
          break;
  
        case 'manual':
          ctx.rawConversation = normalizeManual(input);
          break;
  
        case 'api':
          ctx.rawConversation = normalizeApi(input);
          break;
  
        default:
          ctx._error = `Unknown source type: ${input.source}`;
          return ctx;
      }
  
      // 공통 메타데이터
      ctx.meta = {
        extractedAt: input.extractedAt || new Date().toISOString(),
        source: input.source,
        version: '5.1.0'
      };
  
    } catch (e) {
      ctx._error = `ExtractLayer 실패: ${e.message}`;
    }
  
    return ctx;
  }
  
  // ─── 표준화 함수들 ───
  
  function normalizeExtension(data) {
    return {
      source: data.ai || 'Unknown',
      sourceUrl: data.url || null,
      title: data.title || null,
      rawText: data.text || '',
      timestamp: data.extractedAt || new Date().toISOString(),
  
      // BRAINPOOL 메시지 규격
      messages: parseMessages(data.text, data.ai),
  
      // 원본 보존
      original: {
        host: data.host,
        url: data.url
      }
    };
  }
  
  function normalizeManual(data) {
    return {
      source: 'manual',
      sourceUrl: null,
      title: data.title || '수동 입력',
      rawText: data.text || '',
      timestamp: new Date().toISOString(),
      messages: [{
        role: 'user',
        content: data.text,
        timestamp: new Date().toISOString()
      }],
      original: null
    };
  }
  
  function normalizeApi(data) {
    return {
      source: data.ai || 'API',
      sourceUrl: null,
      title: data.title || null,
      rawText: data.text || '',
      timestamp: data.timestamp || new Date().toISOString(),
      messages: data.messages || [],
      original: data.original || null
    };
  }
  
  // ─── 메시지 파싱 ───
  
  function parseMessages(text, aiSource) {
    if (!text) return [];
  
    // AI별 파싱 전략
    const separators = {
      'Claude': '\n---\n',
      'ChatGPT': '\n---\n',
      'Gemini': '\n---\n',
      'Perplexity': '\n---\n'
    };
  
    const sep = separators[aiSource] || '\n---\n';
    const parts = text.split(sep);
  
    return parts.map((part, index) => ({
      role: index % 2 === 0 ? 'user' : 'assistant',
      content: part.trim(),
      index: index
    })).filter(m => m.content.length > 0);
  }
  
  // ─── 유틸 ───
  
  export function createTraceId() {
    return `tr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
  
  export function sanitizeText(text, maxLength = 10000) {
    if (!text) return '';
    const cleaned = text.replace(/\x00/g, '').trim();
    return cleaned.length > maxLength ? cleaned.substring(0, maxLength) + '... [truncated]' : cleaned;
  }