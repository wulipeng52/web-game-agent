/** 仅含预告片所需的策划片段（避免 client 依赖 lib/ai） */
export type TrailerPlanInput = {
  mechanics: string;
  lore: string;
  assets: string;
};

/** 从游戏 HTML 中取第一张可用封面图，供 Vidu 图生视频（仅支持 1 张图） */
export function extractFirstPublicImageUrlFromHtml(html: string): string | null {
  if (!html?.trim()) return null;
  const candidates: string[] = [];

  let m: RegExpExecArray | null;
  const imgRe = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi;
  while ((m = imgRe.exec(html)) !== null) {
    candidates.push(m[1].trim());
  }

  const cssUrl = /url\(\s*["']?([^"')\s]+)["']?\s*\)/gi;
  while ((m = cssUrl.exec(html)) !== null) {
    const u = m[1].trim();
    if (u.startsWith("http") || u.startsWith("data:image/")) candidates.push(u);
  }

  const og =
    html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)?.[1] ??
    html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i)?.[1];
  if (og?.trim()) candidates.push(og.trim());

  for (const raw of candidates) {
    const u = raw.trim();
    if (u.startsWith("https://") || u.startsWith("http://")) return u;
    if (u.startsWith("data:image/") && u.length <= 4_000_000) return u;
  }
  return null;
}

/** 将策划压成 ≤512 字的预告片提示词（Vidu 限制） */
export function buildGameTrailerPrompt(plan: TrailerPlanInput): string {
  const strip = (s: string) =>
    s
      .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
      .replace(/\[IMAGE_PROMPT:\s*[^\]]+\]/gi, " ")
      .replace(/[#*_`>\-|]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const lore = strip(plan.lore).slice(0, 240);
  const mechanics = strip(plan.mechanics).slice(0, 200);
  const assets = strip(plan.assets).slice(0, 160);
  const text = `游戏预告片。世界观与叙事：${lore} 核心玩法：${mechanics} 视觉基调：${assets}。镜头运动自然，情绪贴合玩法，不要出现文字水印。`;
  return text.length > 512 ? text.slice(0, 512) : text;
}
