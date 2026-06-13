// src/hajuncore/storage/project.js
// ProjectRegistry - 프로젝트 등록 및 DB 연결 관리

import { HajunCore } from '../index.js';

/**
 * ProjectRegistry - 프로젝트 정보와 DB 연결 관리
 */
export const ProjectRegistry = (ctx = {}) => {
  ctx = HajunCore(ctx);

  if (ctx._error) return ctx;

  try {
    const { projectId, supabaseUrl, supabaseKey, action = 'get' } = ctx;

    // 기본 프로젝트 정보
    ctx.project = {
      id: projectId || 'aaaaaaaa-0000-0000-0000-000000000001',
      name: "HajunAI",
      description: "BRAINPOOL OS 최상위 관제 코어",
      createdAt: "2026-05-01"
    };

    // DB 연결 정보 관리
    if (supabaseUrl && supabaseKey) {
      ctx.supabaseConfig = {
        url: supabaseUrl,
        key: supabaseKey,
        connected: true,
        projectId: projectId
      };
      ctx.message = "Supabase 연결 정보가 등록되었습니다.";
    } else if (action === 'register') {
      ctx._error = "Supabase URL과 Key가 필요합니다.";
    }

    console.log(`[ProjectRegistry] ✅ 프로젝트 정보 로드 완료 (ID: ${ctx.project.id})`);

  } catch (e) {
    ctx._error = "ProjectRegistry 실패: " + e.message;
    console.error("[ProjectRegistry]", e);
  }

  return ctx;
};

export default ProjectRegistry;