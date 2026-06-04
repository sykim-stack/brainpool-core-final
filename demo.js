// demo.js - HajunCore 테스트용 데모
// PowerShell에서: node demo.js

import { 
  HajunCore, 
  InjectLayer, 
  ScheduleLayer, 
  SnapshotLayer, 
  ProjectRegistry 
} from './src/hajuncore/index.js';

console.log("=== BRAINPOOL HajunCore 데모 시작 ===\n");

// 1. 기본 HajunCore 초기화
let ctx = HajunCore({
  lastTask: "HajunCore 모듈화 작업",
  projectContext: "BRAINPOOL Life OS 구축 중. CoreRing과 연동 예정."
});

console.log("✅ HajunCore 초기화 완료");

// 2. ScheduleLayer 테스트
ctx = ScheduleLayer({
  ...ctx,
  action: 'get',
  scheduleData: [
    { date: "2026-06-02", title: "CoreNull 설계 검토" },
    { date: "2026-06-03", title: "아내분과 CorePhrase 학습" }
  ]
});

console.log("✅ ScheduleLayer 테스트 완료");
console.log("예정 일정:", ctx.scheduleSummary);

// 3. InjectLayer 테스트 (맥락주입 - 최우선 기능)
ctx = InjectLayer({
  ...ctx,
  recentConversations: [
    "CoreRing에서 user_vocabulary 테이블 완성",
    "카드 플립 학습 모드 구현"
  ],
  coreRingData: {
    vocabulary: ["사랑", "고마워", "미안해", "보고싶어"]
  }
});

console.log("\n✅ InjectLayer (맥락주입) 테스트 완료");
console.log("생성된 주입 프롬프트 길이:", ctx.injectionPrompt?.length || 0);
console.log("\n=== 생성된 맥락 주입 프롬프트 미리보기 ===");
console.log(ctx.injectionPrompt?.substring(0, 400) + "...");

// 4. SnapshotLayer 테스트
ctx = await SnapshotLayer({
  ...ctx,
  rawConversation: {
    source: "Claude",
    rawText: "HajunCore 모듈화를 진행하고 있다. InjectLayer가 핵심이다."
  }
});

console.log("\n✅ SnapshotLayer 테스트 완료");

console.log("\n=== HajunCore 데모 완료 ===");
console.log("HajunAI가 점점 뇌로서 기능하고 있습니다.");