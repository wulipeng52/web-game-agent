import { getZhipuApiKey, getTextModel, extractHtmlFromResponse } from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const currentHtml = body?.currentHtml as string;
    const tweakRequest = body?.tweakRequest as string;

    if (!currentHtml) {
      return new Response(JSON.stringify({ error: "缺少当前游戏代码" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    if (!tweakRequest?.trim()) {
      return new Response(JSON.stringify({ error: "请输入修改需求" }), {
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

    const systemPrompt = `你是一个视觉叙事型网页小游戏原型的代码微调专家。用户会给你一个现有的 HTML 游戏代码和一个修改需求。

你的任务是：
1. 理解现有代码的结构、玩法闭环、视觉主题和数据配置。
2. 根据用户的修改需求，对代码进行必要且克制的修改。
3. 保持游戏可玩：目标、输入、反馈、胜利、失败、重开不能被破坏。
4. 保持原型可维护：优先修改 CONFIG、数据数组、渲染函数或独立处理函数，不要把逻辑堆成更乱的一坨。
5. 如果原代码已经有清晰结构，沿用原有变量名、函数名和代码风格。

重要规则：
- 不要无理由重写整个游戏；只有当原代码本身只是静态展示页、图片相册或不可玩 demo 时，才允许重构为可玩的小游戏原型。
- 如果用户要求调整数值，优先只改 CONFIG 或集中常量。
- 如果用户要求增强画面，优先增强 Canvas/CSS 主题表达、HUD、粒子、状态反馈，不要堆无关照片。
- 如果用户要求添加功能，放进现有状态机、数据数组和 update/render/input 分层中。
- 修改后必须仍然是完整单文件 HTML，可直接在浏览器运行。
- 直接返回完整的修改后的 HTML 代码，不要用 markdown 代码块包裹。
- 不要添加任何解释文字。`;

    const userPrompt = `这是当前的游戏代码：

\`\`\`html
${currentHtml}
\`\`\`

用户的修改需求：${tweakRequest}

请根据需求修改代码，直接返回完整的 HTML，不要用代码块包裹。`;

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
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
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
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ chunk: content })}\n\n`));
                }
              } catch {
                // 忽略解析错误
              }
            }
          }
        }

        const finalHtml = extractHtmlFromResponse(fullContent);
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, html: finalHtml })}\n\n`));
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
