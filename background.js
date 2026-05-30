// BRAINPOOL Core - background.js
console.log("[BRAINPOOL Core] background 로드 시작");
import { runCoreFlow } from './src/core/runCoreFlow.js';

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  console.log("[Core] 메시지:", msg.type);
  if (msg.type === "MANUAL_SNAPSHOT") {
    handleManualSnapshot(msg.data)
      .then(result => sendResponse(result))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (msg.type === "INJECT_CONTENT_SCRIPT") {
    chrome.scripting.executeScript({
      target: { tabId: msg.tabId },
      files: ["content.js"]
    }).then(() => sendResponse({ success: true }))
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  if (msg.type === "GET_STATUS") {
    getStatus().then(sendResponse);
    return true;
  }
  sendResponse({ error: "Unknown type" });
  return false;
});

function detectAI(url) {
  if (!url) return "Unknown";
  if (url.includes("claude.ai")) return "Claude";
  if (url.includes("chatgpt.com")) return "ChatGPT";
  if (url.includes("gemini.google.com")) return "Gemini";
  if (url.includes("perplexity.ai")) return "Perplexity";
  return "AI";
}

function getProjectId(url, ai) {
  return "aaaaaaaa-0000-0000-0000-000000000001";
  if (url.includes("claude.ai")) return "proj-claude";
  if (url.includes("chatgpt.com")) return "proj-chatgpt";
  if (url.includes("gemini.google.com")) return "proj-gemini";
  return "proj-default";
}

async function getStatus() {
  try {
    const tabs = await chrome.tabs.query({});
    const aiSites = ["claude.ai", "chatgpt.com", "gemini.google.com", "perplexity.ai"];
    const aiTabs = tabs.filter(tab => tab.url && aiSites.some(site => tab.url.includes(site)));
    return {
      aiTabs: aiTabs.map(t => ({ id: t.id, title: t.title, url: t.url, ai: detectAI(t.url) })),
      timestamp: new Date().toISOString()
    };
  } catch(e) {
    return { aiTabs: [], error: e.message };
  }
}

async function handleManualSnapshot(data) {
  const storage = await chrome.storage.local.get(["supabaseUrl", "supabaseKey", "geminiApiKey"]);
  if (!storage.supabaseUrl || !storage.supabaseKey) {
    return { success: false, error: "Supabase 설정 필요" };
  }

  const projectId = getProjectId(data.url, data.ai);

  console.log("[Core] runCoreFlow 시작, project_id:", projectId, "대화수:", data.conversation?.length);
  const result = await runCoreFlow({
    supabaseUrl: storage.supabaseUrl,
    supabaseKey: storage.supabaseKey,
    geminiApiKey: storage.geminiApiKey,
    project_id: projectId,
    conversation: data.conversation || [{ role: "user", content: data.text, ai_source: data.ai || "manual" }],
    title: data.title || "대화 저장"
  });

  console.log("[Core] runCoreFlow 결과:", JSON.stringify(result).substring(0, 200));
  return {
    success: result.success,
    error: result.error,
    summary: result.summary,
    next_action: result.next_action,
    prompt: result.prompt
  };
}

console.log("[BRAINPOOL Core] background 통합 완료");

