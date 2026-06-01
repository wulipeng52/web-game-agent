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

    const systemPrompt = `你是一个游戏代码微调专家。用户会给你一个现有的 HTML 游戏代码和一个修改需求。

你的任务是：
1. 理解现有代码的结构和功能
2. 根据用户的修改需求，对代码进行**最小化修改**
3. 保持游戏的核心玩法和结构不变
4. 只修改用户要求的部分

重要规则：
- 不要重写整个游戏，只做必要的修改
- 保持原有的变量名、函数名和代码风格
- 如果用户要求调整数值，只改数值
- 如果用户要求添加功能，尽量用最少的代码实现
- 直接返回完整的修改后的 HTML 代码，不要用 markdown 代码块包裹
- 不要添加任何解释文字`;

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
