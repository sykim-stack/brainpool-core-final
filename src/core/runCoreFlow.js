import { createStorage } from '../storage/index.js';
import { summarize, save } from '../snapshot/index.js';
import { saveMemory, loadMemory } from '../memory/index.js';
import { buildContinuePrompt } from '../continue/index.js';

export async function runCoreFlow(data) {
  let storageInstance = null;
  try {
    if (!data.supabaseUrl || !data.supabaseKey) throw new Error('Supabase 설정 필요');
    storageInstance = createStorage({
      url: data.supabaseUrl,
      key: data.supabaseKey
    });
    let ctx = {
      config: { geminiApiKey: data.geminiApiKey || '' },
      storage: storageInstance,
      payload: {
        project_id: data.project_id || 'default',
        conversation: data.conversation,
        title: data.title || '대화 저장'
      }
    };
    ctx = await summarize(ctx);
    if (ctx._error) throw new Error(ctx._error);
    // ctx = await save(ctx);  // messages 테이블 미사용 시 스킵
    ctx = await saveMemory(ctx);
    if (ctx._error) throw new Error(ctx._error);
    ctx = await loadMemory(ctx);
    if (ctx._error) throw new Error(ctx._error);
    ctx = buildContinuePrompt(ctx);
    return {
      success: true,
      summary:     ctx.payload?.summary?.summary,
      next_action: ctx.payload?.summary?.next_action,  // memory 말고 summary에서 직접
      prompt:      ctx.payload.prompt
    };
  } catch (e) {
    return { success: false, error: e.message };
  }
}

