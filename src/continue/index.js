export function buildContinuePrompt(ctx) {
  const memory = ctx.payload?.memory || {};

  const summaryShort = (memory.summary || '새 프로젝트').length > 150
    ? (memory.summary || '').substring(0, 147) + '...'
    : (memory.summary || '새 프로젝트');

  const prompt = `🦈 BRAINPOOL — 이어서 작업

[마지막 작업]
${memory.last_task || '없음'}

[현재 상황 요약]
${summaryShort}

[지금 바로 할 것]
${memory.next_action || '없음'}

---
위 맥락을 기반으로 바로 이어서 작업해주세요.
별도 설명 없이 [지금 바로 할 것]부터 시작하세요.`;

  ctx.payload.prompt = prompt;
  return ctx;
}
