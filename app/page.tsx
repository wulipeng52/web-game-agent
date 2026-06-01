"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type PlanData = {
  mechanics: string;
  lore: string;
  assets: string;
  technical: string;
  music: string;
  balance: string;
};

const emptyPlan: PlanData = {
  mechanics: "",
  lore: "",
  assets: "",
  technical: "",
  music: "",
  balance: "",
};

function normalizePlan(p: Partial<PlanData> | null | undefined): PlanData {
  if (!p) return emptyPlan;
  return {
    mechanics: p.mechanics ?? "",
    lore: p.lore ?? "",
    assets: p.assets ?? "",
    technical: p.technical ?? "",
    music: p.music ?? "",
    balance: p.balance ?? "",
  };
}

type GenerationPhase = "idle" | "plan" | "game" | "done";
type PlanSectionKey = keyof PlanData;
type GenerationStageKey = "code" | "assets" | "review" | "repair" | "audio" | "done";

const generationStages: Array<{ key: GenerationStageKey; label: string }> = [
  { key: "code", label: "生成代码中" },
  { key: "assets", label: "替换美术资源中" },
  { key: "review", label: "审查可玩性中" },
  { key: "repair", label: "修复数值与性能中" },
  { key: "audio", label: "嵌入语音中" },
  { key: "done", label: "完成" },
];

const STORAGE_KEY = "game-weaver-progress";

function loadFromStorage(): {
  idea: string;
  plan: PlanData;
  previewHtml: string;
} | null {
  if (typeof window === "undefined") return null;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as Partial<{
        idea: string;
        plan: Partial<PlanData>;
        previewHtml: string;
      }>;
      return {
        idea: parsed.idea ?? "",
        plan: normalizePlan(parsed.plan),
        previewHtml: parsed.previewHtml ?? "",
      };
    }
  } catch {
    // 忽略解析错误
  }
  return null;
}

function saveToStorage(data: {
  idea: string;
  plan: PlanData;
  previewHtml: string;
}) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // 忽略存储错误
  }
}

function clearStorage() {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // 忽略错误
  }
}

export default function Home() {
  const [idea, setIdea] = useState<string>("");

  const [plan, setPlan] = useState<PlanData>(emptyPlan);

  const [previewHtml, setPreviewHtml] = useState<string>("");

  const [, setStreamingCode] = useState("");

  const [phase, setPhase] = useState<GenerationPhase>("idle");

  const [error, setError] = useState("");
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [showMiniGame, setShowMiniGame] = useState(false);
  const [gameReady, setGameReady] = useState(false);
  const [tweakRequest, setTweakRequest] = useState("");
  const [isTweaking, setIsTweaking] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [isGeneratingVideo, setIsGeneratingVideo] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const [isSynthesizingBgm, setIsSynthesizingBgm] = useState(false);
  const [generationStage, setGenerationStage] = useState<GenerationStageKey | null>(null);
  const [generationStageNote, setGenerationStageNote] = useState("");

  const [hasRestoredFromCache, setHasRestoredFromCache] = useState(false);

  /** 避免在 useState 初始化里读 localStorage，防止 SSR 与客户端首帧 DOM 不一致 */
  useEffect(() => {
    let cancelled = false;
    const saved = loadFromStorage();
    if (!saved) {
      return;
    }
    queueMicrotask(() => {
      if (cancelled) return;
      setIdea(saved.idea);
      setPlan(saved.plan);
      setPreviewHtml(saved.previewHtml);
      if (saved.previewHtml) setPhase("done");
      setHasRestoredFromCache(Boolean(saved.idea || saved.previewHtml));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // 状态变化时保存到缓存
  useEffect(() => {
    if (idea || plan.mechanics || previewHtml) {
      saveToStorage({ idea, plan, previewHtml });
    }
  }, [idea, plan, previewHtml]);

  // 清除进度
  const handleClearProgress = useCallback(() => {
    clearStorage();
    setIdea("");
    setPlan(emptyPlan);
    setPreviewHtml("");
    setPhase("idle");
    setError("");
    setVideoUrl(null);
    setGenerationStage(null);
    setGenerationStageNote("");
    setHasRestoredFromCache(false);
  }, []);

  const isPlanReady = useMemo(
    () =>
      Boolean(
        plan.mechanics.trim() &&
          plan.lore.trim() &&
          plan.assets.trim() &&
          plan.technical.trim() &&
          plan.music.trim() &&
          plan.balance.trim(),
      ),
    [plan],
  );

  const handleGeneratePlan = useCallback(async () => {
    if (!idea.trim()) return;
    setError("");
    setPhase("plan");
    setStreamingCode("");
    setPreviewHtml("");
    setGameReady(false);

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error ?? "生成策划失败");
      }
      setPlan(result.plan);
      setPhase("done");
    } catch (e) {
      const message = e instanceof Error ? e.message : "生成策划失败";
      setError(message);
      setPhase("idle");
    }
  }, [idea]);

  const handleSynthesizeBgm = useCallback(async () => {
    if (!previewHtml?.trim()) {
      setError("请先生成游戏预览");
      return;
    }
    if (!plan.music?.trim()) {
      setError("策划中缺少「背景音乐」板块内容");
      return;
    }
    setError("");
    setIsSynthesizingBgm(true);
    setGenerationStage("audio");
    setGenerationStageNote("正在重新合成并嵌入语音。");
    try {
      const res = await fetch("/api/generate-bgm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, currentHtml: previewHtml }),
      });
      const j = await res.json();
      if (!res.ok) {
        throw new Error(j?.error ?? "GLM-TTS 合成失败");
      }
      if (j.html) {
        setPreviewHtml(j.html);
      }
      setGenerationStage("done");
      setGenerationStageNote("语音已嵌入，可试玩或保存。");
    } catch (e) {
      setError(e instanceof Error ? e.message : "GLM-TTS 合成失败");
    } finally {
      setIsSynthesizingBgm(false);
    }
  }, [previewHtml, plan]);

  const handleGenerateGame = useCallback(async () => {
    if (!isPlanReady) return;
    setError("");
    setPhase("game");
    setStreamingCode("");
    setPreviewHtml("");
    setShowMiniGame(true);
    setGameReady(false);
    setGenerationStage("code");
    setGenerationStageNote("正在让模型从策划生成完整 HTML 游戏。");

    try {
      const response = await fetch("/api/generate-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error ?? "生成游戏失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.chunk) {
                setStreamingCode((prev) => prev + data.chunk);
              }
              if (data.stage) {
                setGenerationStage(data.stage as GenerationStageKey);
                setGenerationStageNote(String(data.label ?? ""));
              }
              if (data.done && data.html) {
                let nextHtml = data.html as string;
                if (plan.music?.trim()) {
                  try {
                    setGenerationStage("audio");
                    setGenerationStageNote("正在把 GLM-TTS 语音嵌入游戏 HTML。");
                    const bgmRes = await fetch("/api/generate-bgm", {
                      method: "POST",
                      headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ plan, currentHtml: nextHtml }),
                    });
                    const bgmJson = await bgmRes.json();
                    if (bgmRes.ok && typeof bgmJson.html === "string") {
                      nextHtml = bgmJson.html;
                    }
                  } catch {
                    /* 保留无语音版 */
                  }
                }
                setPreviewHtml(nextHtml);
                setPhase("done");
                setGenerationStage("done");
                setGenerationStageNote("游戏已生成，可试玩或保存。");
                setGameReady(true);
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "生成游戏失败";
      setError(message);
      setPhase("idle");
      setShowMiniGame(false);
    }
  }, [isPlanReady, plan]);

  const handleOneClick = useCallback(async () => {
    if (!idea.trim()) return;
    setError("");
    setPhase("plan");
    setStreamingCode("");
    setPreviewHtml("");
    setPlan(emptyPlan);
    setShowMiniGame(false);
    setGameReady(false);
    setGenerationStage(null);
    setGenerationStageNote("");

    try {
      const response = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idea }),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error ?? "生成策划失败");
      }
      setPlan(result.plan);
      setPhase("done");
      setExpandedSection("mechanics");
    } catch (e) {
      const message = e instanceof Error ? e.message : "生成失败";
      setError(message);
      setPhase("idle");
    }
  }, [idea]);

  const handleDownload = useCallback(() => {
    if (!previewHtml) return;
    const blob = new Blob([previewHtml], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `game-${Date.now()}.html`;
    a.click();
    URL.revokeObjectURL(url);
  }, [previewHtml]);

  const handleViewGeneratedGame = useCallback(() => {
    setShowMiniGame(false);
  }, []);

  const handleTweakGame = useCallback(async () => {
    if (!previewHtml || !tweakRequest.trim()) return;
    setError("");
    setIsTweaking(true);
    setShowMiniGame(true);
    setGameReady(false);
    setGenerationStage("code");
    setGenerationStageNote("正在按你的要求微调游戏。");

    try {
      const response = await fetch("/api/tweak-game", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          currentHtml: previewHtml,
          tweakRequest: tweakRequest.trim()
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result?.error ?? "微调游戏失败");
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error("无法读取响应");

      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const data = JSON.parse(line.slice(6));
              if (data.done && data.html) {
                setPreviewHtml(data.html);
                setGenerationStage("done");
                setGenerationStageNote("微调完成，可试玩或保存。");
                setGameReady(true);
                setTweakRequest("");
              }
            } catch {
              // 忽略解析错误
            }
          }
        }
      }
    } catch (e) {
      const message = e instanceof Error ? e.message : "微调游戏失败";
      setError(message);
      setShowMiniGame(false);
    } finally {
      setIsTweaking(false);
    }
  }, [previewHtml, tweakRequest]);

  const handleGenerateVideo = useCallback(async () => {
    if (!plan.lore?.trim() || !previewHtml?.trim()) return;
    setError("");
    setIsGeneratingVideo(true);
    setVideoStatus("正在提交视频生成任务...");
    setVideoUrl(null);

    try {
      const response = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          previewHtml,
          withAudio: false,
        }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result?.error ?? "生成视频失败");
      }

      const taskId = result.task?.id;
      if (!taskId) {
        throw new Error("未获取到任务ID");
      }

      setVideoStatus("视频生成中，请稍候...");

      // 轮询查询任务状态
      const pollInterval = setInterval(async () => {
        try {
          const queryResponse = await fetch("/api/query-video", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ taskId }),
          });

          const queryResult = await queryResponse.json();
          
          if (queryResult.taskStatus === "SUCCESS" && queryResult.videoUrl) {
            clearInterval(pollInterval);
            setVideoUrl(queryResult.videoUrl);
            setVideoStatus("");
            setIsGeneratingVideo(false);
          } else if (queryResult.taskStatus === "FAIL") {
            clearInterval(pollInterval);
            throw new Error("视频生成失败");
          } else {
            setVideoStatus(`视频生成中 (${queryResult.taskStatus || "处理中"})...`);
          }
        } catch (e) {
          clearInterval(pollInterval);
          const message = e instanceof Error ? e.message : "查询视频状态失败";
          setError(message);
          setIsGeneratingVideo(false);
          setVideoStatus("");
        }
      }, 5000); // 每5秒查询一次

      // 最多等待5分钟
      setTimeout(() => {
        clearInterval(pollInterval);
        if (isGeneratingVideo) {
          setError("视频生成超时，请稍后重试");
          setIsGeneratingVideo(false);
          setVideoStatus("");
        }
      }, 300000);

    } catch (e) {
      const message = e instanceof Error ? e.message : "生成视频失败";
      setError(message);
      setIsGeneratingVideo(false);
      setVideoStatus("");
    }
  }, [plan, previewHtml, isGeneratingVideo]);

  const isLoading = phase === "plan" || phase === "game" || isTweaking || isSynthesizingBgm;
  const planSections: Array<{ key: PlanSectionKey; title: string; short: string; icon: string }> = [
    { key: "mechanics", title: "核心玩法", short: "玩法", icon: "🎮" },
    { key: "lore", title: "世界观叙事", short: "叙事", icon: "📖" },
    { key: "assets", title: "视觉与音效", short: "美术", icon: "🎨" },
    { key: "technical", title: "技术逻辑", short: "技术", icon: "⚙️" },
    { key: "music", title: "背景音乐", short: "音乐", icon: "🎵" },
    { key: "balance", title: "数值调校", short: "数值", icon: "🎚️" },
  ];
  const activeSectionKey = (expandedSection as PlanSectionKey | null) ?? "mechanics";
  const activeSection = planSections.find((section) => section.key === activeSectionKey) ?? planSections[0];
  const completedSections = planSections.filter((section) => plan[section.key].trim()).length;

  return (
    <main className="flex min-h-screen flex-col bg-[#0b0d10] text-zinc-100">
      <header className="shrink-0 border-b border-zinc-800 bg-[#101318] px-5 py-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold tracking-tight text-zinc-50">Game Weaver</h1>
              <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-300">
                一句话生成游戏
              </span>
            </div>
            <p className="mt-1 text-xs text-zinc-500">上半区完成创意与策划，下半区专注预览试玩。</p>
          </div>
          <div className="flex items-center gap-2">
            {hasRestoredFromCache && (idea || previewHtml) ? (
              <button
                type="button"
                onClick={() => setHasRestoredFromCache(false)}
                className="rounded-md border border-emerald-700/50 bg-emerald-950/40 px-2.5 py-1.5 text-xs text-emerald-300"
              >
                已恢复进度
              </button>
            ) : null}
            {(idea || previewHtml || plan.mechanics) ? (
              <button
                onClick={handleClearProgress}
                disabled={isLoading}
                className="rounded-md border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs font-medium text-zinc-300 transition hover:border-zinc-600 hover:bg-zinc-800 disabled:opacity-50"
              >
                清除
              </button>
            ) : null}
          </div>
        </div>
      </header>

      <section className="grid min-h-0 flex-1 grid-rows-[auto_minmax(420px,1fr)] overflow-hidden lg:grid-rows-[minmax(360px,42vh)_minmax(0,1fr)]">
        <div className="grid min-h-0 border-b border-zinc-800 lg:grid-cols-[380px_minmax(0,1fr)]">
          <section className="flex min-h-0 flex-col border-b border-zinc-800 bg-[#0f1217] lg:border-b-0 lg:border-r">
            <div className="border-b border-zinc-800 px-4 py-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-zinc-100">创意输入</h2>
                  <p className="mt-0.5 text-xs text-zinc-500">写玩法、题材、氛围，也可以直接写限制。</p>
                </div>
                <span className="text-xs text-zinc-500">{idea.trim().length} 字</span>
              </div>
            </div>
            <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
              <textarea
                value={idea}
                onChange={(e) => setIdea(e.target.value)}
                disabled={isLoading}
                className="h-32 shrink-0 resize-none rounded-md border border-zinc-800 bg-[#151922] p-3 text-sm leading-6 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/30 disabled:opacity-50 lg:min-h-0 lg:flex-1"
                placeholder="例如：做一个月蚀酒馆里的卡牌战斗游戏，玩家用记忆、谎言和契约组成牌组，对抗会改变规则的客人。"
              />
              {error ? (
                <div className="rounded-md border border-red-900/70 bg-red-950/40 px-3 py-2 text-xs text-red-200">{error}</div>
              ) : null}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!idea.trim() || isLoading}
                  onClick={handleOneClick}
                  className="rounded-md bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {phase === "plan" ? (
                    <span className="flex items-center justify-center gap-2"><LoadingSpinner />生成策划中</span>
                  ) : "生成策划"}
                </button>
                <button
                  type="button"
                  disabled={!isPlanReady || isLoading}
                  onClick={handleGenerateGame}
                  className="rounded-md bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-zinc-950 transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {phase === "game" ? (
                    <span className="flex items-center justify-center gap-2"><LoadingSpinner />生成游戏中</span>
                  ) : "生成游戏"}
                </button>
              </div>
              <button
                type="button"
                disabled={!idea.trim() || isLoading}
                onClick={handleGeneratePlan}
                className="rounded-md border border-zinc-800 px-3 py-2 text-xs font-medium text-zinc-400 transition hover:border-zinc-700 hover:bg-zinc-900 disabled:opacity-50"
              >
                重新生成策划
              </button>
            </div>
          </section>

          <section className="flex min-h-0 flex-col bg-[#0c0f14]">
            <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-4 py-3">
              <div>
                <h2 className="text-sm font-semibold text-zinc-100">六个策划块</h2>
                <p className="mt-0.5 text-xs text-zinc-500">卡牌式切换，右侧编辑当前块。</p>
              </div>
              <div className="flex items-center gap-2 text-xs text-zinc-500">
                <span className="rounded-md border border-zinc-800 px-2 py-1">{completedSections}/6</span>
                <span className={isPlanReady ? "text-emerald-300" : "text-zinc-500"}>
                  {isPlanReady ? "可生成" : "待完善"}
                </span>
              </div>
            </div>

            <div className="grid min-h-0 flex-1 gap-4 p-4 xl:grid-cols-[minmax(340px,440px)_minmax(0,1fr)]">
              <div className="grid auto-rows-fr grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-2">
                {planSections.map((section) => {
                  const filled = plan[section.key].trim().length > 0;
                  const active = activeSection.key === section.key;
                  return (
                    <button
                      key={section.key}
                      type="button"
                      onClick={() => setExpandedSection(section.key)}
                      disabled={isLoading}
                      className={[
                        "group flex min-h-[82px] flex-col justify-between rounded-md border p-3 text-left transition disabled:opacity-50",
                        active
                          ? "border-indigo-400 bg-indigo-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]"
                          : "border-zinc-800 bg-[#141821] hover:border-zinc-700 hover:bg-[#181d27]",
                      ].join(" ")}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-xs text-zinc-500">{section.short}</span>
                        <span className={filled ? "h-2 w-2 rounded-full bg-emerald-400" : "h-2 w-2 rounded-full bg-zinc-700"} />
                      </span>
                      <span>
                        <span className="block text-sm font-semibold text-zinc-100">{section.title}</span>
                        <span className="mt-1 block truncate text-xs text-zinc-500">
                          {filled ? plan[section.key].replace(/[#*_`>-]/g, " ").trim() : "等待生成或手动填写"}
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex min-h-[220px] flex-col rounded-md border border-zinc-800 bg-[#11151d]">
                <div className="flex items-center justify-between gap-3 border-b border-zinc-800 px-3 py-2.5">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-zinc-100">{activeSection.title}</h3>
                    <p className="text-xs text-zinc-500">生成游戏会使用这里的最新内容。</p>
                  </div>
                  <span className="shrink-0 rounded-md bg-zinc-900 px-2 py-1 text-xs text-zinc-400">
                    {plan[activeSection.key].trim().length} 字
                  </span>
                </div>
                <textarea
                  value={plan[activeSection.key]}
                  onChange={(e) => setPlan((p) => ({ ...p, [activeSection.key]: e.target.value }))}
                  disabled={isLoading}
                  className="min-h-[180px] flex-1 resize-none rounded-b-md bg-transparent p-3 text-xs leading-6 text-zinc-200 outline-none placeholder:text-zinc-600 disabled:opacity-50 lg:min-h-0"
                  placeholder={`在这里编辑「${activeSection.title}」...`}
                />
              </div>
            </div>
          </section>
        </div>

        <section className="flex min-h-0 flex-col bg-zinc-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800 bg-[#101318] px-4 py-2.5">
            <div className="flex items-center gap-3">
              <h2 className="text-sm font-semibold text-zinc-100">游戏预览</h2>
              <span className="rounded-md border border-zinc-800 px-2 py-1 text-xs text-zinc-500">
                {showMiniGame && isLoading ? "等待中" : showMiniGame && gameReady ? "已生成" : previewHtml ? "可试玩" : "未生成"}
              </span>
              {isLoading ? (
                <span className="flex items-center gap-1 text-xs text-emerald-300">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {phase === "plan" ? "生成策划" : isTweaking ? "微调中" : isSynthesizingBgm ? "合成语音" : "生成游戏"}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {showMiniGame && previewHtml ? (
                <button onClick={handleViewGeneratedGame} className="rounded-md bg-emerald-500 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-emerald-400">查看游戏</button>
              ) : null}
              {previewHtml ? (
                <button onClick={handleDownload} className="rounded-md bg-zinc-100 px-3 py-1.5 text-xs font-semibold text-zinc-950 transition hover:bg-white">保存游戏</button>
              ) : null}
            </div>
          </div>

          <div className="relative min-h-0 flex-1">
            {showMiniGame ? (
              <WaitingMiniGame
                gameReady={gameReady}
                generationStage={generationStage}
                generationStageNote={generationStageNote}
                onViewGame={handleViewGeneratedGame}
              />
            ) : previewHtml ? (
              <iframe
                title="game-preview"
                className="h-full w-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-zinc-600">
                <div className="text-center">
                  <div className="mb-3 text-5xl">🎮</div>
                  <p className="text-sm text-zinc-500">生成后这里显示可玩预览。</p>
                </div>
              </div>
            )}
          </div>

          {previewHtml && !showMiniGame ? (
            <div className="border-t border-zinc-800 bg-[#101318] p-3">
              <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_auto_auto]">
                <input
                  type="text"
                  value={tweakRequest}
                  onChange={(e) => setTweakRequest(e.target.value)}
                  disabled={isLoading || isGeneratingVideo || isSynthesizingBgm}
                  placeholder="微调游戏，例如：降低敌人速度、增加防御牌、让第一回合更宽容..."
                  className="min-w-0 rounded-md border border-zinc-800 bg-[#151922] px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-amber-500 disabled:opacity-50"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && !e.shiftKey) {
                      e.preventDefault();
                      handleTweakGame();
                    }
                  }}
                />
                <button
                  type="button"
                  disabled={!tweakRequest.trim() || isLoading || isGeneratingVideo || isSynthesizingBgm}
                  onClick={handleTweakGame}
                  className="rounded-md bg-amber-500 px-4 py-2 text-sm font-semibold text-zinc-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isTweaking ? "微调中" : "微调游戏"}
                </button>
                <button
                  type="button"
                  disabled={!previewHtml || !plan.music?.trim() || isLoading || isSynthesizingBgm}
                  onClick={handleSynthesizeBgm}
                  className="rounded-md border border-zinc-700 px-4 py-2 text-sm font-medium text-zinc-300 transition hover:bg-zinc-800 disabled:opacity-40"
                >
                  {isSynthesizingBgm ? "语音中" : "语音"}
                </button>
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                <button
                  type="button"
                  disabled={!plan.lore?.trim() || !previewHtml?.trim() || isLoading || isGeneratingVideo || isSynthesizingBgm}
                  onClick={handleGenerateVideo}
                  className="text-zinc-400 underline-offset-4 hover:text-zinc-200 hover:underline disabled:pointer-events-none disabled:opacity-40"
                >
                  {isGeneratingVideo ? "预告生成中" : "生成预告"}
                </button>
                {videoStatus ? <span className="text-purple-300">{videoStatus}</span> : null}
                {videoUrl ? <a href={videoUrl} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:underline">查看视频</a> : null}
              </div>
            </div>
          ) : null}
        </section>
      </section>
    </main>
  );
}

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function WaitingMiniGame({
  gameReady,
  generationStage,
  generationStageNote,
  onViewGame,
}: {
  gameReady: boolean;
  generationStage: GenerationStageKey | null;
  generationStageNote: string;
  onViewGame: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const gameStateRef = useRef({
    playerY: 250,
    playerVelocity: 0,
    obstacles: [] as { x: number; gapY: number; passed: boolean }[],
    score: 0,
    gameOver: false,
    started: false,
    diedThisFrame: false,
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const game = gameStateRef.current;
    let animationId: number;

    const GRAVITY = 0.15;
    const JUMP = -5;
    const PIPE_WIDTH = 45;
    const GAP_HEIGHT = 200;
    const PIPE_SPEED = 1.5;

    // —— Web Audio：无需外链文件，适合等待小游戏 ——
    type Ctx = AudioContext;
    let actx: Ctx | null = null;
    const bgmOsc: OscillatorNode[] = [];
    let bgmOn = false;

    const getCtx = (): Ctx | null => {
      if (typeof window === "undefined") return null;
      if (!actx) {
        const AC = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return null;
        actx = new AC();
      }
      if (actx.state === "suspended") void actx_RESUME(actx);
      return actx;
    };

    function actx_RESUME(a: Ctx) {
      return a.resume();
    }

    const startBgm = () => {
      const c = getCtx();
      if (!c || bgmOn) return;
      bgmOn = true;
      const freqs = [98, 146.83];
      for (const f of freqs) {
        const o = c.createOscillator();
        const g = c.createGain();
        o.type = "sine";
        o.frequency.value = f;
        g.gain.value = 0.02;
        o.connect(g);
        g.connect(c.destination);
        o.start();
        bgmOsc.push(o);
      }
    };

    const stopBgm = () => {
      for (const o of bgmOsc) {
        try {
          o.stop();
        } catch {
          /* already stopped */
        }
      }
      bgmOsc.length = 0;
      bgmOn = false;
    };

    const playJump = () => {
      const c = getCtx();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(350, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(620, c.currentTime + 0.07);
      g.gain.setValueAtTime(0.11, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.09);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.1);
    };

    const playScore = () => {
      const c = getCtx();
      if (!c) return;
      const notes = [523.25, 659.25];
      notes.forEach((freq, i) => {
        const o = c!.createOscillator();
        const g = c!.createGain();
        o.type = "triangle";
        o.frequency.value = freq;
        const t0 = c!.currentTime + i * 0.04;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.09, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.12);
        o.connect(g);
        g.connect(c!.destination);
        o.start(t0);
        o.stop(t0 + 0.14);
      });
    };

    const playGameOver = () => {
      const c = getCtx();
      if (!c) return;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = "sawtooth";
      o.frequency.setValueAtTime(220, c.currentTime);
      o.frequency.exponentialRampToValueAtTime(70, c.currentTime + 0.35);
      g.gain.setValueAtTime(0.09, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.42);
      o.connect(g);
      g.connect(c.destination);
      o.start();
      o.stop(c.currentTime + 0.45);
    };

    const jump = () => {
      getCtx();
      playJump();
      startBgm();

      if (game.gameOver) {
        game.playerY = 250;
        game.playerVelocity = 0;
        game.obstacles = [];
        game.score = 0;
        game.gameOver = false;
        game.started = true;
      } else {
        game.started = true;
        game.playerVelocity = JUMP;
      }
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
    };

    const handleClick = () => jump();

    canvas.addEventListener("click", handleClick);
    window.addEventListener("keydown", handleKey);

    const gameLoop = () => {
      game.diedThisFrame = false;

      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // 星星背景
      ctx.fillStyle = "#ffffff22";
      for (let i = 0; i < 50; i++) {
        const x = (i * 137 + game.score * 0.5) % canvas.width;
        const y = (i * 73) % canvas.height;
        ctx.fillRect(x, y, 2, 2);
      }

      if (!game.started) {
        ctx.fillStyle = "#fff";
        ctx.font = "24px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("🦖 恐龙跑酷", canvas.width / 2, 200);
        ctx.font = "16px system-ui";
        ctx.fillText("点击或按空格开始", canvas.width / 2, 250);
        ctx.fillText("躲避障碍，比比看谁分更高！", canvas.width / 2, 280);
        animationId = requestAnimationFrame(gameLoop);
        return;
      }

      if (!game.gameOver) {
        game.playerVelocity += GRAVITY;
        game.playerY += game.playerVelocity;

        if (game.obstacles.length === 0 || game.obstacles[game.obstacles.length - 1].x < canvas.width - 300) {
          game.obstacles.push({
            x: canvas.width,
            gapY: 100 + Math.random() * (canvas.height - 200 - GAP_HEIGHT),
            passed: false,
          });
        }

        for (const obs of game.obstacles) {
          obs.x -= PIPE_SPEED;

          if (!obs.passed && obs.x + PIPE_WIDTH < 80) {
            obs.passed = true;
            game.score++;
            playScore();
          }

          const playerLeft = 60;
          const playerRight = 100;
          const playerTop = game.playerY;
          const playerBottom = game.playerY + 30;

          if (
            playerRight > obs.x &&
            playerLeft < obs.x + PIPE_WIDTH &&
            (playerTop < obs.gapY || playerBottom > obs.gapY + GAP_HEIGHT)
          ) {
            game.gameOver = true;
            game.diedThisFrame = true;
          }
        }

        game.obstacles = game.obstacles.filter((o) => o.x > -PIPE_WIDTH);

        if (game.playerY < 0 || game.playerY > canvas.height - 30) {
          game.gameOver = true;
          game.diedThisFrame = true;
        }
      }

      if (game.diedThisFrame) {
        playGameOver();
      }

      // 绘制障碍物
      ctx.fillStyle = "#6366f1";
      for (const obs of game.obstacles) {
        ctx.fillRect(obs.x, 0, PIPE_WIDTH, obs.gapY);
        ctx.fillRect(obs.x, obs.gapY + GAP_HEIGHT, PIPE_WIDTH, canvas.height - obs.gapY - GAP_HEIGHT);
        
        ctx.fillStyle = "#818cf8";
        ctx.fillRect(obs.x - 5, obs.gapY - 20, PIPE_WIDTH + 10, 20);
        ctx.fillRect(obs.x - 5, obs.gapY + GAP_HEIGHT, PIPE_WIDTH + 10, 20);
        ctx.fillStyle = "#6366f1";
      }

      // 绘制玩家（小火箭）
      ctx.fillStyle = "#10b981";
      ctx.beginPath();
      ctx.moveTo(100, game.playerY + 15);
      ctx.lineTo(60, game.playerY);
      ctx.lineTo(60, game.playerY + 30);
      ctx.closePath();
      ctx.fill();
      
      ctx.fillStyle = "#f59e0b";
      ctx.beginPath();
      ctx.moveTo(60, game.playerY + 10);
      ctx.lineTo(45, game.playerY + 15);
      ctx.lineTo(60, game.playerY + 20);
      ctx.closePath();
      ctx.fill();

      // 分数
      ctx.fillStyle = "#fff";
      ctx.font = "bold 24px system-ui";
      ctx.textAlign = "left";
      ctx.fillText(`分数: ${game.score}`, 20, 40);

      if (game.gameOver) {
        ctx.fillStyle = "rgba(0,0,0,0.7)";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#fff";
        ctx.font = "32px system-ui";
        ctx.textAlign = "center";
        ctx.fillText("游戏结束！", canvas.width / 2, canvas.height / 2 - 20);
        ctx.font = "20px system-ui";
        ctx.fillText(`最终分数: ${game.score}`, canvas.width / 2, canvas.height / 2 + 20);
        ctx.font = "16px system-ui";
        ctx.fillText("点击重新开始", canvas.width / 2, canvas.height / 2 + 60);
      }

      animationId = requestAnimationFrame(gameLoop);
    };

    gameLoop();

    return () => {
      stopBgm();
      cancelAnimationFrame(animationId);
      canvas.removeEventListener("click", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="relative flex h-full w-full flex-col items-center justify-center gap-4 bg-zinc-900 p-4">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="max-h-[65%] max-w-full rounded-lg shadow-2xl"
        style={{ imageRendering: "pixelated" }}
      />

      <div className="w-full max-w-4xl rounded-md border border-zinc-800 bg-zinc-950/70 p-3">
        <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {generationStages.map((stage) => {
            const currentIndex = generationStage
              ? generationStages.findIndex((item) => item.key === generationStage)
              : -1;
            const stageIndex = generationStages.findIndex((item) => item.key === stage.key);
            const isDone = currentIndex > stageIndex || generationStage === "done";
            const isActive = generationStage === stage.key && generationStage !== "done";
            return (
              <div
                key={stage.key}
                className={[
                  "rounded-md border px-2.5 py-2 text-xs",
                  isActive
                    ? "border-emerald-500/50 bg-emerald-500/10 text-emerald-200"
                    : isDone
                    ? "border-zinc-700 bg-zinc-900 text-zinc-300"
                    : "border-zinc-800 bg-zinc-950 text-zinc-600",
                ].join(" ")}
              >
                <span className="block truncate">{stage.label}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-2 min-h-4 text-xs text-zinc-500">
          {generationStageNote || "生成开始后，这里会显示当前阶段。"}
        </p>
      </div>
      
      {gameReady && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="bg-zinc-800 rounded-xl p-6 text-center shadow-2xl border border-zinc-700">
            <div className="text-4xl mb-4">🎉</div>
            <h3 className="text-xl font-bold mb-2">游戏生成完成！</h3>
            <p className="text-zinc-400 mb-4">你的游戏已经准备好了</p>
            <button
              onClick={onViewGame}
              className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-emerald-500 px-6 py-3 text-sm font-semibold text-white hover:opacity-90 transition"
            >
              查看我的游戏
            </button>
          </div>
        </div>
      )}
      
      <div className="absolute bottom-4 left-4 text-xs text-zinc-500">
        空格/点击跳跃 | 边玩边等待
      </div>
    </div>
  );
}

