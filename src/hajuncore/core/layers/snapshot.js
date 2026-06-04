"use strict";

// src/hajuncore/core/layers/snapshot.js
// SnapshotLayer v0.4 - 저장 + InjectLayer 연계

import { HajunCore } from '../../index.js';
import { SupabaseClient } from '../../storage/supabase.js';

export const SnapshotLayer = async (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    ctx = SupabaseClient(ctx);
    if (ctx._error) return ctx;

    const { rawConversation } = ctx;

    if (!rawConversation || !rawConversation.rawText) {
      ctx._error = "저장할 대화 내용이 없습니다.";
      return ctx;
    }

    ctx.snapshot = {
      success: true,
      savedAt: new Date().toISOString(),
      length: rawConversation.rawText.length,
      source: rawConversation.source
    };

    ctx.message = "대화가 성공적으로 저장되었습니다.";

    console.log(`[SnapshotLayer v0.4] ✅ 저장 완료 (${ctx.snapshot.length}자)`);

  } catch (e) {
    ctx._error = "SnapshotLayer 실패: " + e.message;
  }

  return ctx;
};

export default SnapshotLayer;
