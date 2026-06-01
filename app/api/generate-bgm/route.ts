import { NextResponse } from "next/server";
import {
  extractTtsNarrationFromMusic,
  injectBgmDataUrl,
  type PlanData,
  synthesizeGlmTtsToBase64,
} from "@/lib/ai";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const plan = body?.plan as PlanData | undefined;
    const textOverride = typeof body?.text === "string" ? body.text.trim() : "";
    const currentHtml = typeof body?.currentHtml === "string" ? body.currentHtml : "";

    let ttsText = textOverride;
    if (!ttsText && plan?.music) {
      ttsText = extractTtsNarrationFromMusic(plan.music);
    }
    if (!ttsText) {
      return NextResponse.json({ error: "请提供 plan.music 或直接传入 text" }, { status: 400 });
    }

    const wavBase64 = await synthesizeGlmTtsToBase64(ttsText);
    const dataUrl = `data:audio/wav;base64,${wavBase64}`;

    let htmlOut: string | undefined;
    if (currentHtml) {
      htmlOut = injectBgmDataUrl(currentHtml, wavBase64);
    }

    return NextResponse.json({
      dataUrl,
      html: htmlOut,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
