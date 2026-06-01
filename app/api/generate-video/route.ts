import { NextResponse } from "next/server";
import {
  generateTrailerCoverFromHint,
  generateTrailerCoverImage,
  generateVideoTask,
} from "@/lib/ai";
import {
  buildGameTrailerPrompt,
  extractFirstPublicImageUrlFromHtml,
  type TrailerPlanInput,
} from "@/lib/trailer-helpers";

function sliceTrailerPlan(body: unknown): TrailerPlanInput | null {
  if (!body || typeof body !== "object") return null;
  const p = body as Record<string, unknown>;
  const lore = String(p.lore ?? "").trim();
  if (!lore) return null;
  return {
    lore,
    mechanics: String(p.mechanics ?? "").trim(),
    assets: String(p.assets ?? "").trim(),
  };
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const previewHtml = typeof body?.previewHtml === "string" ? body.previewHtml : "";
    const planSlice = sliceTrailerPlan(body?.plan);

    const imageOverride = typeof body?.imageUrl === "string" ? body.imageUrl.trim() : "";
    const promptOverride = typeof body?.prompt === "string" ? body.prompt.trim() : "";

    if (!planSlice && !promptOverride) {
      return NextResponse.json({ error: "请提供含「世界观」的 plan 或自定义 prompt" }, { status: 400 });
    }

    let cover: string | null = null;
    if (imageOverride && (/^https?:\/\//.test(imageOverride) || imageOverride.startsWith("data:image/"))) {
      cover = imageOverride;
    } else if (imageOverride) {
      cover = extractFirstPublicImageUrlFromHtml(imageOverride);
    }
    if (!cover) {
      cover = extractFirstPublicImageUrlFromHtml(previewHtml);
    }

    let coverSource: "html" | "generated" = "html";
    if (!cover) {
      if (planSlice) {
        cover = await generateTrailerCoverImage(planSlice);
        coverSource = "generated";
      } else if (promptOverride) {
        cover = await generateTrailerCoverFromHint(promptOverride);
        coverSource = "generated";
      }
    }

    if (!cover) {
      return NextResponse.json(
        {
          error:
            "无法获得预告片封面图：游戏 HTML 中未找到可用图片，且文生图兜底失败（请检查 ZHIPU_API_KEY / 文生图配置）。",
        },
        { status: 400 },
      );
    }

    const prompt =
      (promptOverride ? promptOverride.slice(0, 512) : "") ||
      (planSlice ? buildGameTrailerPrompt(planSlice) : "");

    if (!prompt.trim()) {
      return NextResponse.json({ error: "预告片需要策划文案或 prompt" }, { status: 400 });
    }

    const task = await generateVideoTask({
      prompt,
      imageUrl: cover,
      size: "1920x1080",
      duration: 5,
      movementAmplitude: body?.movementAmplitude ?? "auto",
      withAudio: false,
      requestId: typeof body?.requestId === "string" ? body.requestId : undefined,
      userId: typeof body?.userId === "string" ? body.userId : undefined,
    });

    return NextResponse.json({ task, coverSource });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
