import { NextResponse } from "next/server";
import { getZhipuApiKey } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const taskId = typeof body?.taskId === "string" ? body.taskId.trim() : "";

    if (!taskId) {
      return NextResponse.json({ error: "taskId 不能为空" }, { status: 400 });
    }

    const apiKey = getZhipuApiKey();
    if (!apiKey) {
      return NextResponse.json({ error: "ZHIPU_API_KEY 未配置" }, { status: 500 });
    }

    const response = await fetch(
      `https://open.bigmodel.cn/api/paas/v4/async-result/${taskId}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      }
    );

    if (!response.ok) {
      const message = await response.text();
      return NextResponse.json({ error: `查询失败: ${message}` }, { status: 500 });
    }

    const data = await response.json();
    
    return NextResponse.json({
      taskStatus: data.task_status,
      videoUrl: data.video_result?.[0]?.url || null,
      coverUrl: data.video_result?.[0]?.cover_image_url || null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
