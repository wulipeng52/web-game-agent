import type { PlanData } from "@/lib/ai";

/** 首行标识，便于识别与版本演进 */
export const PLAN_TXT_MAGIC = "GameWeaver-Plan-TXT-v1";

const SECTION_KEYS = ["mechanics", "lore", "assets", "technical", "music"] as const satisfies readonly (keyof PlanData)[];

function sectionTag(key: (typeof SECTION_KEYS)[number]) {
  return `<<<section:${key}>>>`;
}

/** 将五段策划导出为可逆 TXT（UTF-8） */
export function planToTxt(plan: PlanData): string {
  const parts: string[] = [PLAN_TXT_MAGIC, ""];
  for (const key of SECTION_KEYS) {
    parts.push(sectionTag(key), plan[key] ?? "", "");
  }
  return parts.join("\n");
}

/**
 * 从 TXT 解析五段策划。按固定顺序截取各 <<<section:key>>> 区块。
 * 允许缺少部分区块（未出现的字段视为未提供）。
 */
export function parsePlanTxt(text: string): Partial<PlanData> {
  let raw = text.replace(/^\uFEFF/, "").trimStart();
  if (raw.toLowerCase().startsWith(PLAN_TXT_MAGIC.toLowerCase())) {
    raw = raw.slice(PLAN_TXT_MAGIC.length).replace(/^\s*\n?/, "");
  }

  const result: Partial<PlanData> = {};

  for (let i = 0; i < SECTION_KEYS.length; i++) {
    const key = SECTION_KEYS[i];
    const tag = sectionTag(key);
    const start = raw.indexOf(tag);
    if (start === -1) {
      continue;
    }
    const afterTag = start + tag.length;
    const nl = raw.slice(afterTag).match(/^\r?\n/);
    const contentStart = afterTag + (nl?.[0]?.length ?? 0);
    const nextKey = SECTION_KEYS[i + 1];
    let end = raw.length;
    if (nextKey) {
      const nextTag = sectionTag(nextKey);
      const nextIdx = raw.indexOf(nextTag, contentStart);
      if (nextIdx !== -1) {
        end = nextIdx;
      }
    }
    result[key] = raw.slice(contentStart, end).replace(/\s+$/, "");
  }

  return result;
}

export function hasAnyPlanSection(parsed: Partial<PlanData>): boolean {
  return SECTION_KEYS.some((k) => parsed[k] !== undefined && String(parsed[k]).length > 0);
}
