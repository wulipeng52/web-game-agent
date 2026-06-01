import { NextResponse } from "next/server";
import { generatePlanFromIdea } from "@/lib/ai";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const idea = String(body?.idea ?? "").trim();

    if (!idea) {
      return NextResponse.json({ error: "idea 不能为空" }, { status: 400 });
    }

    const plan = await generatePlanFromIdea(idea);
    return NextResponse.json({ plan });
  } catch (error) {
    const message = error instanceof Error ? error.message : "未知错误";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
