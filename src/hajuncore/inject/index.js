"use strict";

// src/hajuncore/inject/index.js
// InjectLayer v0.8 - 가장 단순하고 안전한 버전

import { HajunCore } from '../index.js';

export const InjectLayer = (ctx = {}) => {
  ctx = HajunCore(ctx);
  if (ctx._error) return ctx;

  try {
    const lastTask = ctx.lastTask || "HajunAI 작업 진행 중";

    let prompt = `🦈 BRAINPOOL OS - HajunAI 맥락 주입 (v0.8)

당신은 BRAINPOOL OS의 핵심 개발자입니다. 아래 맥락을 완벽히 이해하고 이어서 작업해주세요.

=== 📊 현재 프로젝트 상태 ===
진행 중인 작업: ${lastTask}

=== 📜 BRAINPOOL 계약서 준수 ===
- 모든 함수는 (ctx) => ctx 형태
- throw 절대 금지, _error 필드만 사용`;

    ctx.injectionPrompt = prompt;
    ctx.injectionReady = true;
    ctx.message = "기본 맥락 주입 프롬프트 생성 완료";

    console.log("[InjectLayer v0.8] ✅ 단순 안전 프롬프트 생성");

  } catch (e) {
    ctx._error = "InjectLayer 실패: " + e.message;
  }

  return ctx;
};

export default InjectLayer;
