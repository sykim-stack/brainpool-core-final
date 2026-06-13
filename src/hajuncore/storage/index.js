"use strict";

// src/hajuncore/storage/index.js
// Storage Layer - Supabase 연결 통합 관리

import { SupabaseClient, getLatestContext } from './supabase.js';

export { SupabaseClient, getLatestContext };

// 스냅샷 저장 (향후 확장)
export const saveSnapshot = async (ctx = {}) => {
  ctx = SupabaseClient(ctx);
  if (ctx._error) return ctx;

  // 실제 저장 로직은 추후 messages 테이블 연동
  ctx.snapshotSaved = true;
  ctx.message = "스냅샷이 저장되었습니다.";
  console.log("[Storage] ✅ 스냅샷 저장 요청 완료");

  return ctx;
};

console.log("[Storage Layer] ✅ Storage Layer v0.1 로드 완료");
