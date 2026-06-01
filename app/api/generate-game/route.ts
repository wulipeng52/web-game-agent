import {
  readPromptFile,
  getZhipuApiKey,
  getTextModel,
  extractHtmlFromResponse,
  generateAssetUrls,
  injectAssetUrls,
  reviewAndRepairGameHtmlWithTimeout,
} from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 900;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = body?.plan;

    const mechanics = String(plan?.mechanics ?? "").trim();
    const lore = String(plan?.lore ?? "").trim();
    const assetsMd = String(plan?.assets ?? "").trim();
    const technical = String(plan?.technical ?? "").trim();
    const music = String(plan?.music ?? "").trim();
    const balance = String(plan?.balance ?? "").trim();

    if (!mechanics || !lore || !assetsMd || !technical || !music || !balance) {
      return new Response(JSON.stringify({ error: "plan 缺少必要字段" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    const apiKey = getZhipuApiKey();
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ZHIPU_API_KEY 未配置" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    // 并行启动图片生成（不阻塞代码生成）
    const assetPromise = generateAssetUrls(assetsMd).catch(() => []);

    const coderPrompt = await readPromptFile("coder.md");
    const content = `策划案如下：
# 核心玩法 (Mechanics)
${mechanics}

# 世界观与叙事 (Lore)
${lore}

# 视觉与音效规范 (Assets)
${assetsMd}

# 技术逻辑 (Technical)
${technical}

# 背景音乐与氛围语音 (Music)
${music}

# 数值调校 (Balance)
${balance}

重要：直接返回完整的 HTML 代码，不要用 markdown 代码块包裹，不要添加任何解释文字。`;

    const response = await fetch(
      process.env.ZHIPU_CHAT_URL ?? "https://open.bigmodel.cn/api/paas/v4/chat/completions",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: getTextModel(),
          stream: true,
          messages: [
            { role: "system", content: coderPrompt },
            { role: "user", content },
          ],
        }),
      }
    );

    if (!response.ok) {
      const message = await response.text();
      return new Response(JSON.stringify({ error: `API 调用失败: ${message}` }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const reader = response.body?.getReader();
    if (!reader) {
      return new Response(JSON.stringify({ error: "无法读取响应" }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    let fullContent = "";

    const stream = new ReadableStream({
      async start(controller) {
        let buffer = "";
        const send = (payload: Record<string, unknown>) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
        };

        send({ stage: "code", label: "生成代码中", status: "active" });

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
                  fullContent += content;
                  send({ chunk: content });
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        // 等待图片生成完成，然后替换占位符
        send({ stage: "assets", label: "替换美术资源中", status: "active" });
        const assets = await assetPromise;
        let finalHtml = extractHtmlFromResponse(fullContent);
        if (assets.length > 0) {
          finalHtml = injectAssetUrls(finalHtml, assets);
        }
        send({ stage: "review", label: "审查可玩性中", status: "active" });
        send({ stage: "repair", label: "修复数值与性能中", status: "active" });
        const repairResult = await reviewAndRepairGameHtmlWithTimeout(
          { mechanics, lore, assets: assetsMd, technical, music, balance },
          finalHtml,
          120_000,
        );
        finalHtml = repairResult.html;
        if (repairResult.timedOut) {
          send({ stage: "repair", label: "审查超时，已保留原始可玩版本", status: "fallback" });
        } else if (repairResult.error) {
          send({ stage: "repair", label: repairResult.error, status: "fallback" });
        }

        send({ done: true, html: finalHtml, assets, repair: repairResult });
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
