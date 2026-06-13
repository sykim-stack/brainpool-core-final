// src/hajuncore/storage/supabase.js
// Supabase 연결 및 데이터 조회 유틸리티 (HajunCore용)

import { HajunCore } from '../index.js';

/**
 * Supabase 클라이언트 관리
 */
export const SupabaseClient = (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    const { supabaseUrl, supabaseKey } = ctx;

    if (!supabaseUrl || !supabaseKey) {
      ctx._error = "Supabase URL과 Key가 필요합니다.";
      return ctx;
    }

    ctx.supabase = {
      url: supabaseUrl,
      key: supabaseKey,
      connected: true
    };

    ctx.message = "Supabase 연결 정보가 로드되었습니다.";

  } catch (e) {
    ctx._error = "SupabaseClient 초기화 실패: " + e.message;
  }

  return ctx;
};

/**
 * contexts 테이블에서 최신 데이터 가져오기
 */
export const getLatestContext = async (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    const { supabase } = ctx;
    if (!supabase || !supabase.connected) {
      ctx._error = "Supabase가 연결되지 않았습니다.";
      return ctx;
    }

    const response = await fetch(`${supabase.url}/rest/v1/contexts?order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': supabase.key,
        'Authorization': `Bearer ${supabase.key}`
      }
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    ctx.latestContext = data[0] || {};
    ctx.message = "최신 contexts 데이터를 불러왔습니다.";

  } catch (e) {
    ctx._error = "getLatestContext 실패: " + e.message;
  }

  return ctx;
};

export default { SupabaseClient, getLatestContext };