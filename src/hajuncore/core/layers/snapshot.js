"use strict";
// src/hajuncore/core/layers/snapshot.js
// SnapshotLayer v0.5 - 실제 Supabase 저장

import { HajunCore } from '../../index.js';
import { SupabaseClient } from '../../storage/supabase.js';

export const SnapshotLayer = async (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    ctx = SupabaseClient(ctx);
    if (ctx._error) return ctx;

    const { rawConversation, supabase } = ctx;

    if (!rawConversation || !rawConversation.rawText) {
      ctx._error = "저장할 대화 내용이 없습니다.";
      return ctx;
    }

    const payload = {
      project_id: ctx.projectId || "aaaaaaaa-0000-0000-0000-000000000001",
      source_ai: rawConversation.source || "unknown",
      original_message: rawConversation.rawText,
      summary: rawConversation.summary || null,
      keywords: rawConversation.keywords || [],
      connections: rawConversation.connections || [],
      meta: {
        title: rawConversation.title || null,
        url: rawConversation.url || null,
        savedAt: new Date().toISOString(),
        traceId: ctx.traceId
      }
    };

    const response = await fetch(`${supabase.url}/rest/v1/hajunai_conversations`, {
      method: "POST",
      headers: {
        'apikey': supabase.key,
        'Authorization': `Bearer ${supabase.key}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errText = await response.text();
      ctx._error = "Supabase 저장 실패: " + errText;
      return ctx;
    }

    const saved = await response.json();

    ctx.snapshot = {
      success: true,
      savedAt: payload.meta.savedAt,
      id: saved[0]?.id || null,
      length: rawConversation.rawText.length,
      source: rawConversation.source
    };
    ctx.message = "대화가 성공적으로 저장되었습니다.";
    console.log(`[SnapshotLayer v0.5] ✅ Supabase 저장 완료 (id: ${ctx.snapshot.id})`);

  } catch (e) {
    ctx._error = "SnapshotLayer 실패: " + e.message;
  }

  return ctx;
};

export default SnapshotLayer;
