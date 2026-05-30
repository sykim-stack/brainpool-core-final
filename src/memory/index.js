// src/memory/index.js
export async function saveMemory(ctx) {
  const storage = ctx.storage;
  if (!storage) {
    ctx._error = "storage가 초기화되지 않았습니다";
    return ctx;
  }
  const summary = ctx.payload?.summary || {};
  const memory = {
    project_id: ctx.payload.project_id || 'default',
    last_task: summary.last_task || 'Untitled',
    summary: summary.summary || '',
    next_action: summary.next_action || '',
    updated_at: new Date().toISOString()
  };
  const result = await storage.upsert({
    table: 'contexts',
    payload: memory
  }, ctx);
  ctx.payload.memorySaved = !result._error;
  return ctx;
}

export async function loadMemory(ctx) {
  const storage = ctx.storage;
  const projectId = ctx.payload.project_id || 'default';
  const result = await storage.get({
    table: 'contexts',
    query: { project_id: projectId }
  }, ctx);
  ctx.payload.memory = result?.payload?.data?.[0] || null;
  return ctx;
}
