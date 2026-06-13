import { HajunCore, InjectLayer } from './src/hajuncore/index.js';
import { SupabaseClient, getLatestContext } from './src/hajuncore/storage/supabase.js';
import { SnapshotLayer } from './src/hajuncore/core/layers/snapshot.js';

let ctx = HajunCore({
  supabaseUrl: "https://grlfocvlfatuvphkyivd.supabase.co",
  supabaseKey: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdybGZvY3ZsZmF0dXZwaGt5aXZkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAzNDM1MzksImV4cCI6MjA4NTkxOTUzOX0.4dLzD1AYSuigxU_Q5ZZwZ6XDGejMvbuoYIjmB4D7dxo"
});

// Snapshot 저장 테스트
ctx = await SnapshotLayer({
  ...ctx,
  rawConversation: {
    source: "Claude",
    rawText: "HajunCore SnapshotLayer v0.5 실제 저장 테스트",
    title: "SnapshotLayer 테스트",
    summary: "저장 기능 검증"
  }
});

if (ctx._error) {
  console.log("❌ 저장 실패:", ctx._error);
} else {
  console.log("✅ 저장 완료:", ctx.snapshot);
}

// InjectLayer 연결 확인
ctx = SupabaseClient(ctx);
ctx = await getLatestContext(ctx);
ctx = InjectLayer(ctx);
console.log("\n=== 프롬프트 확인 ===");
console.log(ctx.injectionPrompt);
