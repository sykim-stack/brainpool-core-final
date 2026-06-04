// src/hajuncore/schedule/index.js
// ScheduleLayer - 일정 관리 및 HajunCore 연동

import { HajunCore } from '../index.js';

/**
 * ScheduleLayer - 일정 조회, 추가, HajunAI 맥락에 반영
 */
export const ScheduleLayer = (ctx = {}) => {
  ctx = HajunCore(ctx);

  if (ctx._error) return ctx;

  try {
    const { action = 'get', scheduleData = [], newSchedule = null } = ctx;

    ctx.schedules = scheduleData;

    if (action === 'add' && newSchedule) {
      // 새 일정 추가 로직 (실제 Supabase 연동은 storage에서)
      ctx.schedules.push({
        id: 'sched-' + Date.now(),
        ...newSchedule,
        createdAt: new Date().toISOString()
      });
      ctx.message = `일정 추가 완료: ${newSchedule.title}`;
    }

    // 오늘/이번주 일정 요약 (맥락주입에 활용)
    const today = new Date().toISOString().split('T')[0];
    const upcoming = ctx.schedules
      .filter(s => s.date >= today)
      .sort((a, b) => a.date.localeCompare(b.date))
      .slice(0, 5);

    ctx.upcomingSchedules = upcoming;
    
    if (upcoming.length > 0) {
      ctx.scheduleSummary = upcoming.map(s => 
        `${s.date}: ${s.title}`
      ).join('\n');
    } else {
      ctx.scheduleSummary = "이번 주 등록된 일정이 없습니다.";
    }

    console.log(`[ScheduleLayer] ✅ 처리 완료 (예정 일정 ${upcoming.length}개)`);

  } catch (e) {
    ctx._error = "ScheduleLayer 실패: " + e.message;
    console.error("[ScheduleLayer]", e);
  }

  return ctx;
};

export default ScheduleLayer;