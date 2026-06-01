import { readFile } from "node:fs/promises";
import path from "node:path";

export type PlanData = {
  mechanics: string;
  lore: string;
  assets: string;
  technical: string;
  /** 背景音乐 / 氛围语音（Markdown），供 GLM-TTS 入稿 */
  music: string;
  /** 数值调校与难度曲线（Markdown），供代码生成和审查使用 */
  balance: string;
};

const ZHIPU_CHAT_URL = process.env.ZHIPU_CHAT_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions";
const ZHIPU_IMAGE_URL = process.env.ZHIPU_IMAGE_URL ?? "https://open.bigmodel.cn/api/paas/v4/images/generations";
const ZHIPU_VIDEO_URL = process.env.ZHIPU_VIDEO_URL ?? "https://open.bigmodel.cn/api/paas/v4/videos/generations";
const ZHIPU_SPEECH_URL = process.env.ZHIPU_SPEECH_URL ?? "https://open.bigmodel.cn/api/paas/v4/audio/speech";

export async function readPromptFile(filename: string) {
  const promptPath = path.join(process.cwd(), "prompts", filename);
  return readFile(promptPath, "utf-8");
}

export function getZhipuApiKey() {
  return process.env.ZHIPU_API_KEY;
}

export function getTextModel() {
  return process.env.ZHIPU_TEXT_MODEL ?? "glm-5.1";
}

function getTextFromChatResponse(data: unknown): string {
  const payload = data as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const content = payload?.choices?.[0]?.message?.content;
  if (!content) {
    throw new Error("模型未返回可读取文本。");
  }
  return content;
}

export async function callZhipuJSON<T>(prompt: string, userInput: string): Promise<T> {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY 未配置，无法调用智谱文本模型。");
  }

  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getTextModel(),
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`智谱文本模型调用失败: ${response.status} ${message}`);
  }

  const data = await response.json();
  const rawText = getTextFromChatResponse(data);
  return JSON.parse(rawText) as T;
}

export async function callZhipuText(prompt: string, userInput: string): Promise<string> {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY 未配置，无法调用智谱文本模型。");
  }

  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getTextModel(),
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`智谱文本模型调用失败: ${response.status} ${message}`);
  }

  const data = await response.json();
  return getTextFromChatResponse(data);
}

export async function* callZhipuStream(prompt: string, userInput: string): AsyncGenerator<string> {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY 未配置，无法调用智谱文本模型。");
  }

  const response = await fetch(ZHIPU_CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getTextModel(),
      stream: true,
      messages: [
        { role: "system", content: prompt },
        { role: "user", content: userInput },
      ],
    }),
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`智谱文本模型调用失败: ${response.status} ${message}`);
  }

  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("无法读取响应流");
  }

  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed === "data: [DONE]") continue;
      if (trimmed.startsWith("data: ")) {
        try {
          const json = JSON.parse(trimmed.slice(6));
          const content = json?.choices?.[0]?.delta?.content;
          if (content) {
            yield content;
          }
        } catch {
          // 忽略解析错误
        }
      }
    }
  }
}

export async function generatePlanFromIdea(idea: string): Promise<PlanData> {
  const plannerPrompt = await readPromptFile("planner.md");
  const jsonInstruction = `
请基于上方规范输出 JSON（不要输出 Markdown 代码块），格式必须是：
{
  "mechanics": "Markdown 字符串",
  "lore": "Markdown 字符串",
  "assets": "Markdown 字符串",
  "technical": "Markdown 字符串",
  "music": "Markdown 字符串",
  "balance": "Markdown 字符串"
}
每个字段都应包含对应部分的完整内容。`;

  const raw = await callZhipuJSON<Partial<PlanData>>(
    plannerPrompt,
    `用户创意（可包含对背景音乐、氛围、旁白风格的期望，请整体纳入策划）：\n${idea}\n\n${jsonInstruction}`,
  );
  return {
    mechanics: raw.mechanics ?? "",
    lore: raw.lore ?? "",
    assets: raw.assets ?? "",
    technical: raw.technical ?? "",
    music: raw.music ?? "",
    balance: raw.balance ?? "",
  };
}

/** 从策划 Music 段落抽取适合 GLM-TTS 的纯文本（有长度上限） */
export function extractTtsNarrationFromMusic(musicMarkdown: string, maxLen = 480): string {
  let t = musicMarkdown
    .replace(/^#{1,6}\s+.*$/gm, "")
    .replace(/[*_`]/g, "")
    .replace(/\[[^\]]*\]/g, "")
    .replace(/\n+/g, " ")
    .trim();

  const scriptIdx = t.search(/朗读脚本|TTS|文案|入稿/i);
  if (scriptIdx >= 0) {
    t = t.slice(scriptIdx).replace(/^[^:]+:\s*/, "").trim();
  }

  if (t.length > maxLen) {
    t = t.slice(0, maxLen);
  }
  return t || "欢迎来到这场小游戏，愿你玩得开心。";
}

export async function synthesizeGlmTtsToBase64(input: string): Promise<string> {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY 未配置，无法调用 GLM-TTS。");
  }
  const text = input.trim().slice(0, 500);
  if (!text) {
    throw new Error("TTS 文本为空。");
  }

  const response = await fetch(ZHIPU_SPEECH_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: process.env.ZHIPU_TTS_MODEL ?? "glm-tts",
      input: text,
      voice: process.env.ZHIPU_TTS_VOICE ?? "female",
      speed: Number(process.env.ZHIPU_TTS_SPEED ?? 1.0),
      volume: Number(process.env.ZHIPU_TTS_VOLUME ?? 1.0),
      response_format: "wav",
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`GLM-TTS 调用失败: ${response.status} ${err}`);
  }

  const buf = Buffer.from(await response.arrayBuffer());
  return buf.toString("base64");
}

/** 将 base64 wav 以 data URL 形式嵌入 HTML，循环播放 */
export function injectBgmDataUrl(html: string, wavBase64: string): string {
  const dataUrl = `data:audio/wav;base64,${wavBase64}`;
  const snippet = `
<audio id="gw-bgm" loop playsinline preload="auto" crossorigin="anonymous" style="display:none">
  <source src="${dataUrl}" type="audio/wav" />
</audio>
<script>
(function(){
  var el = document.getElementById("gw-bgm");
  if (!el) return;
  function tryPlay(){
    el.play().catch(function(){});
  }
  el.addEventListener("canplay", tryPlay, { once: true });
  document.addEventListener("click", tryPlay, { once: true });
  document.addEventListener("keydown", tryPlay, { once: true });
})();
</script>`;

  const out = html.replace(
    /<audio id="gw-bgm"[\s\S]*?<\/audio>\s*<script>[\s\S]*?<\/script>/gi,
    "",
  );

  if (/<\/body>/i.test(out)) {
    return out.replace(/<\/body>/i, `${snippet}</body>`);
  }
  return out + snippet;
}

type ImageAsset = { prompt: string; url: string };

function sanitizeSeed(input: string) {
  return encodeURIComponent(input.trim().slice(0, 60).replace(/\s+/g, "-"));
}

async function createImage(prompt: string): Promise<string> {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    return `https://picsum.photos/seed/${sanitizeSeed(prompt)}/1024/768`;
  }

  try {
    const response = await fetch(ZHIPU_IMAGE_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.ZHIPU_IMAGE_MODEL ?? "cogview-3-flash",
        prompt,
        size: "1024x1024",
      }),
    });

    if (!response.ok) {
      return `https://picsum.photos/seed/${sanitizeSeed(prompt)}/1024/768`;
    }

    const data = (await response.json()) as {
      data?: Array<{ url?: string }>;
    };
    const imageUrl = data?.data?.[0]?.url;
    if (imageUrl) {
      return imageUrl;
    }
  } catch {
    // 图片生成失败，使用占位图
  }

  return `https://picsum.photos/seed/${sanitizeSeed(prompt)}/1024/768`;
}

export function extractImagePrompts(assetsMarkdown: string): string[] {
  const lines = assetsMarkdown
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const candidates = lines
    .filter((line) => line.startsWith("-") || line.startsWith("*") || /^\d+\./.test(line))
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/^\d+\.\s*/, ""));

  return candidates.slice(0, 4);
}

export async function generateAssetUrls(assetsMarkdown: string): Promise<ImageAsset[]> {
  const prompts = extractImagePrompts(assetsMarkdown);
  const uniquePrompts = [...new Set(prompts)];
  const urls = await Promise.all(uniquePrompts.map((prompt) => createImage(prompt)));
  return uniquePrompts.map((prompt, index) => ({ prompt, url: urls[index] }));
}

/**
 * 预告片图生视频缺封面时：按策划现生成一张公网 URL 图（与游戏 HTML 内是否有 img 标签无关）。
 */
export async function generateTrailerCoverImage(plan: {
  lore: string;
  mechanics: string;
  assets: string;
}): Promise<string> {
  const fromAssets = extractImagePrompts(plan.assets);
  const hint = [plan.lore, plan.mechanics].join(" ").replace(/\s+/g, " ").trim().slice(0, 320);
  const prompt =
    (fromAssets[0] ? `${fromAssets[0]}，` : "") +
    `游戏宣传主视觉封面，${hint}，单张插画、构图饱满、适于作视频首帧，无文字水印，16:9 宽画幅，高清`;
  return createImage(prompt.slice(0, 900));
}

/** 仅有短文案、无完整策划切片时的封面兜底 */
export async function generateTrailerCoverFromHint(text: string): Promise<string> {
  const hint = text.replace(/\s+/g, " ").trim().slice(0, 400);
  return createImage(`游戏概念宣传图，${hint}，单张插画、无文字，16:9`);
}

export async function generateGameCode(plan: PlanData): Promise<string> {
  const coderPrompt = await readPromptFile("coder.md");
  const content = `策划案如下：
# 核心玩法 (Mechanics)
${plan.mechanics}

# 世界观与叙事 (Lore)
${plan.lore}

# 视觉与音效规范 (Assets)
${plan.assets}

# 技术逻辑 (Technical)
${plan.technical}

# 背景音乐与氛围语音 (Music)
${plan.music}

# 数值调校 (Balance)
${plan.balance}

请返回完整 HTML 代码，不要用 markdown 代码块包裹。`;

  let result = "";
  for await (const chunk of callZhipuStream(coderPrompt, content)) {
    result += chunk;
  }
  return result;
}

export async function reviewAndRepairGameHtml(plan: PlanData, html: string): Promise<string> {
  const prompt = `你是网页小游戏的质量审查、性能优化与数值调校专家。

请审查用户提供的单文件 HTML 游戏。你的目标不是重写创意，而是在保持原玩法和主题的前提下修复明显问题。

重点检查：
1. 是否真的可玩：有目标、输入、反馈、胜利/失败、重开。
2. 是否过度默认跑酷：如果策划不是跑酷，不能把游戏修成单纯躲障碍。
3. 性能是否稳定：requestAnimationFrame、对象数量上限、粒子生命周期、无无限生成、无主循环 innerHTML。
4. 数值是否合理：速度、冷却、生成频率、敌人数量、生命值、难度曲线不能太快、太慢、太难、太空。
5. 前 10 秒是否有学习空间，30-90 秒是否有完整体验。
6. 是否能在无外部图片时继续显示可玩画面。

如果 HTML 已经合格，只返回原 HTML。
如果不合格，请直接返回修复后的完整 HTML。

严格要求：只返回完整 HTML，不要 Markdown 代码块，不要解释。`;

  const userInput = `策划案：
# 核心玩法 (Mechanics)
${plan.mechanics}

# 世界观叙事 (Lore)
${plan.lore}

# 视觉与音效规范 (Assets)
${plan.assets}

# 技术逻辑 (Technical)
${plan.technical}

# 背景音乐与氛围语音 (Music)
${plan.music}

# 数值调校 (Balance)
${plan.balance}

待审查 HTML：
${html}`;

  const reviewed = await callZhipuText(prompt, userInput);
  return extractHtmlFromResponse(reviewed);
}

export async function reviewAndRepairGameHtmlWithTimeout(
  plan: PlanData,
  html: string,
  timeoutMs = 120_000,
): Promise<{ html: string; repaired: boolean; timedOut: boolean; error?: string }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    const reviewed = await Promise.race([
      reviewAndRepairGameHtml(plan, html).then((result) => ({
        html: result,
        repaired: result.trim() !== html.trim(),
        timedOut: false,
      })),
      new Promise<{ html: string; repaired: boolean; timedOut: boolean }>((resolve) => {
        timeoutId = setTimeout(() => resolve({ html, repaired: false, timedOut: true }), timeoutMs);
      }),
    ]);
    return reviewed;
  } catch (error) {
    return {
      html,
      repaired: false,
      timedOut: false,
      error: error instanceof Error ? error.message : "审查修复失败，已返回原始游戏",
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Vidu 图生视频要求 image_url 为「单个」字符串 URL；
 * 若误传 JSON 数组或多 URL 字符串，只取第一张，避免 1214 报错。
 */
export function normalizeSingleImageUrlForVidu(raw: string): string {
  const s = raw.trim();
  if (!s) {
    throw new Error("封面图 URL 为空");
  }
  if (s.startsWith("[") && s.includes("http")) {
    try {
      const arr = JSON.parse(s) as unknown;
      if (Array.isArray(arr)) {
        const first = arr.find((x) => typeof x === "string" && /^https?:\/\//.test(x));
        if (first) return String(first);
      }
    } catch {
      /* 按普通字符串处理 */
    }
  }
  const m = s.match(/https?:\/\/[^\s"'<>\]]+/);
  if (m) return m[0];
  if (s.startsWith("data:image/")) return s.split(/[\s,]+/)[0] ?? s;
  return s;
}

export function getVideoConfig() {
  return {
    enabled: Boolean(process.env.ZHIPU_API_KEY),
    model: process.env.ZHIPU_VIDEO_MODEL ?? "viduq1-image",
    endpoint: ZHIPU_VIDEO_URL,
  };
}

export type VideoGenerationParams = {
  prompt?: string;
  imageUrl?: string;
  size?: "1920x1080";
  duration?: 5;
  movementAmplitude?: "auto" | "small" | "medium" | "large";
  withAudio?: boolean;
  requestId?: string;
  userId?: string;
};

export async function generateVideoTask(params: VideoGenerationParams) {
  const apiKey = getZhipuApiKey();
  if (!apiKey) {
    throw new Error("ZHIPU_API_KEY 未配置，无法调用智谱文生视频。");
  }

  const model = process.env.ZHIPU_VIDEO_MODEL ?? "viduq1-image";
  const prompt = (params.prompt ?? "").trim().slice(0, 512);
  const isViduImage2Video = model === "viduq1-image" || model === "vidu2-image";
  const isViduText = model === "viduq1-text";

  if (isViduImage2Video) {
    if (!params.imageUrl?.trim()) {
      throw new Error(
        "当前为 Vidu 图生视频模型，必须在请求中提供 1 张公网可访问的封面图 URL（单图 image_url）。",
      );
    }
  } else if (isViduText) {
    if (!prompt) {
      throw new Error("viduq1-text 需要提供文本 prompt。");
    }
  } else if (!prompt && !params.imageUrl?.trim()) {
    throw new Error("prompt 和 imageUrl 至少需要提供一个。");
  }

  const payload: Record<string, unknown> = { model };

  if (isViduImage2Video) {
    const imageUrl = normalizeSingleImageUrlForVidu(params.imageUrl!);
    payload.image_url = imageUrl;
    if (prompt) payload.prompt = prompt;
    payload.duration = params.duration ?? (model === "vidu2-image" ? 4 : 5);
    payload.size =
      params.size ?? (model === "vidu2-image" ? ("1280x720" as const) : ("1920x1080" as const));
    payload.movement_amplitude = params.movementAmplitude ?? "auto";
    // 官方图生视频示例不含 with_audio；且 with_audio 仅部分 4s 场景支持，避免误触服务端校验
  } else if (isViduText) {
    payload.prompt = prompt;
    payload.style = process.env.ZHIPU_VIDEO_STYLE ?? "general";
    payload.duration = params.duration ?? 5;
    payload.aspect_ratio = "16:9";
    payload.size = params.size ?? "1920x1080";
    payload.movement_amplitude = params.movementAmplitude ?? "auto";
  } else {
    payload.prompt = prompt || undefined;
    payload.image_url = params.imageUrl?.trim() || undefined;
    payload.duration = params.duration ?? 5;
    payload.size = params.size ?? "1920x1080";
    payload.movement_amplitude = params.movementAmplitude ?? "auto";
    payload.with_audio = params.withAudio ?? false;
  }

  if (params.requestId) payload.request_id = params.requestId;
  if (params.userId) payload.user_id = params.userId;

  const body = JSON.stringify(payload, (_k, v) => (v === undefined ? undefined : v));

  const response = await fetch(ZHIPU_VIDEO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`智谱文生视频调用失败: ${response.status} ${message}`);
  }

  const data = (await response.json()) as {
    model?: string;
    id?: string;
    request_id?: string;
    task_status?: string;
  };

  return {
    model: data.model ?? process.env.ZHIPU_VIDEO_MODEL ?? "viduq1-image",
    id: data.id ?? "",
    requestId: data.request_id ?? "",
    taskStatus: data.task_status ?? "PROCESSING",
  };
}

export function injectAssetUrls(code: string, assets: ImageAsset[]) {
  let pointer = 0;
  return code.replace(/\[IMAGE_PROMPT:\s*([^\]]+)\]/g, (_all, rawPrompt: string) => {
    const prompt = String(rawPrompt).trim().toLowerCase();
    const matched = assets.find((item) => item.prompt.toLowerCase().includes(prompt));
    if (matched) {
      return matched.url;
    }
    const fallback = assets[pointer] ?? assets[assets.length - 1];
    pointer += 1;
    return fallback?.url ?? `https://picsum.photos/seed/${sanitizeSeed(prompt)}/1024/768`;
  });
}

export function extractHtmlFromResponse(text: string): string {
  let html = text.trim();
  
  // 尝试匹配完整的代码块
  const codeBlockMatch = html.match(/```(?:html)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    html = codeBlockMatch[1].trim();
  } else {
    // 如果没有闭合的代码块，尝试匹配开头的代码块（处理截断情况）
    const unclosedMatch = html.match(/```(?:html)?\s*([\s\S]*)/);
    if (unclosedMatch) {
      html = unclosedMatch[1].trim();
    }
  }
  
  // 尝试从 <!DOCTYPE 或 <html 开始截取
  const doctypeIndex = html.indexOf("<!DOCTYPE");
  const htmlTagIndex = html.indexOf("<html");
  const startIndex = doctypeIndex !== -1 ? doctypeIndex : htmlTagIndex;
  
  if (startIndex > 0) {
    html = html.slice(startIndex);
  }
  
  // 移除可能残留的结尾代码块标记
  html = html.replace(/```\s*$/, "").trim();
  
  // 检查并补全缺失的闭合标签
  if (html.includes("<html") && !html.includes("</html>")) {
    // 先补全可能缺失的 body 和 html 闭合标签
    if (html.includes("<body") && !html.includes("</body>")) {
      html += "\n</body>";
    }
    html += "\n</html>";
  }
  
  // 如果完全没有 HTML 结构，包装成完整页面
  if (!html.includes("<!DOCTYPE") && !html.includes("<html")) {
    html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Game</title>
  <style>
    body { font-family: system-ui, sans-serif; margin: 0; padding: 20px; background: #1a1a2e; color: #fff; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
  }
  
  return html;
}
