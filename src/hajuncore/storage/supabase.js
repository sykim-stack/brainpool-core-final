"use strict";

// src/hajuncore/storage/supabase.js
// Supabase 연결 모듈

import { HajunCore } from '../index.js';

export const SupabaseClient = (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

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

  console.log("[SupabaseClient] ✅ 연결 정보 로드 완료");
  return ctx;
};

export const getLatestContext = async (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    const { supabase } = ctx;
    if (!supabase?.connected) {
      ctx._error = "Supabase가 연결되지 않았습니다.";
      return ctx;
    }

    const res = await fetch(`${supabase.url}/rest/v1/contexts?order=updated_at.desc&limit=1`, {
      headers: {
        'apikey': supabase.key,
        'Authorization': `Bearer ${supabase.key}`
      }
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const data = await res.json();
    ctx.latestContext = data[0] || {};
    console.log("[getLatestContext] ✅ 데이터 로드 완료");

  } catch (e) {
    ctx._error = "getLatestContext 실패: " + e.message;
  }

  return ctx;
};
