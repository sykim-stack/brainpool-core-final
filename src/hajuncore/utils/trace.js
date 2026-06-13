// src/hajuncore/utils/trace.js

/**
 * traceId 생성 유틸리티
 */
export const createTraceId = () => {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  return `tr-${timestamp}-${random}`;
};

/**
 * 현재 시간 포맷 (KST)
 */
export const getKSTTime = () => {
  const now = new Date();
  return now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
};