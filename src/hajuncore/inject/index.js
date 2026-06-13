"use strict";

import { HajunCore } from '../index.js';

const formatList = (val) => {
  if (!val || val.length === 0) return "정보 없음";
  if (Array.isArray(val)) return val.map(v => `- ${v}`).join('\n');
  return val;
};

export const InjectLayer = (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    const c = ctx.latestContext || {};

    const prompt = `🦈 BRAINPOOL OS - HajunAI 맥락 주입 (v0.9)

당신은 BRAINPOOL OS의 핵심 개발자입니다. 아래 맥락을 완벽히 이해하고 이어서 작업해주세요.

=== 📊 현재 프로젝트 상태 ===
페이즈: ${c.phase || "미확인"}
상태: ${c.status || "미확인"}
헬스스코어: ${c.health_score ?? "?"}

진행 중인 작업: ${c.last_task || ctx.lastTask || "HajunAI 작업 진행 중"}
다음 액션: ${c.next_action || "미확인"}
현재 문제: ${c.current_problems || "없음"}

=== 🏗️ 아키텍처 ===
${c.architecture || "정보 없음"}

=== 📦 스택 & 핵심 파일 ===
스택: ${c.stack || "정보 없음"}
핵심 파일:
${formatList(c.key_files)}

=== ✅ 완료된 작업 ===
${formatList(c.completed_tasks)}

=== 🎯 다음 작업 ===
${formatList(c.next_tasks)}

=== 📜 BRAINPOOL 계약서 준수 ===
- 모든 함수는 (ctx) => ctx 형태
- throw 절대 금지, _error 필드만 사용`;

    ctx.injectionPrompt = prompt;
    ctx.injectionReady = true;
    ctx.message = "맥락 주입 프롬프트 생성 완료 (v0.9)";

    console.log("[InjectLayer v0.9] ✅ latestContext 완전 연결 프롬프트 생성");

  } catch (e) {
    ctx._error = "InjectLayer 실패: " + e.message;
  }

  return ctx;
};

export default InjectLayer;
