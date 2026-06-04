"use strict";

// src/hajuncore/index.js
// HajunCore - BRAINPOOL 최상위 공유 코어

export const createTraceId = () => {
  return "tr-" + Date.now() + "-" + Math.random().toString(36).substr(2, 9);
};

/**
 * HajunCore 메인 진입점
 */
export const HajunCore = (ctx = {}) => {
  const baseCtx = {
    traceId: ctx.traceId || createTraceId(),
    projectId: ctx.projectId || "aaaaaaaa-0000-0000-0000-000000000001",
    timestamp: new Date().toISOString(),
    version: "0.1.0",
    _error: null,
    ...ctx
  };

  console.log("[HajunCore] 🚀 초기화 - TraceId: " + baseCtx.traceId);
  return baseCtx;
};

// Layer Exports
export { default as InjectLayer } from './inject/index.js';
export { default as ScheduleLayer } from './schedule/index.js';
export { default as SnapshotLayer } from './core/layers/snapshot.js';
export { default as ProjectRegistry } from './storage/project.js';

// Utils
export * from './utils/index.js';

console.log("[HajunCore] ✅ HajunCore v0.1.0 (Inject + Schedule + Snapshot) 로드 완료");
