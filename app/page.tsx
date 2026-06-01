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
              if (data.done && data.html) {
                let nextHtml = data.html as string;
                if (plan.music?.trim()) {
                  try {
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

  return (
    <main className="flex min-h-screen flex-col bg-gradient-to-br from-zinc-950 via-zinc-900 to-zinc-950 text-zinc-100">
      <header className="border-b border-zinc-800/50 bg-zinc-900/30 backdrop-blur px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-emerald-400 bg-clip-text text-transparent">
              Game Weaver
            </h1>
            <p className="text-sm text-zinc-500">一句话创意 → 可玩游戏</p>
          </div>
          <div className="flex gap-2">
            {(idea || previewHtml || plan.mechanics) && (
              <button
                onClick={handleClearProgress}
                disabled={isLoading}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 px-3 py-2 text-sm font-medium hover:bg-zinc-700 transition disabled:opacity-50"
                title="清除当前进度，重新开始"
              >
                🗑️ 清除
              </button>
            )}
            {showMiniGame && previewHtml && (
              <button
                onClick={handleViewGeneratedGame}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 transition"
              >
                🎮 查看生成的游戏
              </button>
            )}
            {previewHtml && !showMiniGame && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-2 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium hover:bg-zinc-700 transition"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                下载游戏
              </button>
            )}
          </div>
        </div>
      </header>

      <section className="grid flex-1 grid-cols-1 lg:grid-cols-[400px_minmax(0,1fr)] overflow-hidden">
        <div className="flex flex-col border-r border-zinc-800/50 bg-zinc-900/20 overflow-y-auto">
          <div className="p-4 border-b border-zinc-800/50">
            <label className="text-sm font-medium text-zinc-400 mb-2 block">游戏创意</label>
            <textarea
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              disabled={isLoading}
              className="w-full h-28 rounded-lg border border-zinc-700/50 bg-zinc-800/50 p-3 text-sm outline-none placeholder:text-zinc-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 transition resize-none disabled:opacity-50"
              placeholder="用一段话描述玩法与世界观；若希望有特定氛围声或旁白风格，可一并写进创意里（如：配舒缓宇宙感、紧张鼓点旁白等），策划与 GLM-TTS 会整体采纳。"
            />

            <div className="flex gap-2 mt-3">
              <button
                type="button"
                disabled={!idea.trim() || isLoading}
                onClick={handleOneClick}
                className="flex-1 rounded-lg bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-indigo-400 transition"
              >
                {phase === "plan" ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    生成策划中...
                  </span>
                ) : (
                  "1. 生成策划案"
                )}
              </button>
            </div>

            {isPlanReady && (
              <div className="flex flex-col gap-2 mt-3">
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGenerateGame}
                  className="w-full rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-90 transition"
                >
                  {phase === "game" ? (
                    <span className="flex items-center justify-center gap-2">
                      <LoadingSpinner />
                      生成游戏中...
                    </span>
                  ) : (
                    "2. 生成游戏 🎮"
                  )}
                </button>
                <button
                  type="button"
                  disabled={isLoading}
                  onClick={handleGeneratePlan}
                  className="w-full rounded-lg border border-zinc-700 px-3 py-2 text-xs font-medium hover:bg-zinc-800 transition disabled:opacity-50"
                >
                  重新生成策划
                </button>
              </div>
            )}
          </div>

          {hasRestoredFromCache && (idea || previewHtml) && (
            <div className="mx-4 mt-4 rounded-lg border border-emerald-800/50 bg-emerald-950/30 p-3 text-sm text-emerald-300 flex items-center justify-between">
              <span>✨ 已恢复上次的进度</span>
              <button
                onClick={() => setHasRestoredFromCache(false)}
                className="text-emerald-400 hover:text-emerald-300"
              >
                ✕
              </button>
            </div>
          )}

          {error && (
            <div className="mx-4 mt-4 rounded-lg border border-red-800/50 bg-red-950/30 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            <CollapsibleSection
              title="核心玩法"
              icon="🎮"
              value={plan.mechanics}
              onChange={(v) => setPlan((p) => ({ ...p, mechanics: v }))}
              expanded={expandedSection === "mechanics"}
              onToggle={() => setExpandedSection(expandedSection === "mechanics" ? null : "mechanics")}
              disabled={isLoading}
            />
            <CollapsibleSection
              title="世界观叙事"
              icon="📖"
              value={plan.lore}
              onChange={(v) => setPlan((p) => ({ ...p, lore: v }))}
              expanded={expandedSection === "lore"}
              onToggle={() => setExpandedSection(expandedSection === "lore" ? null : "lore")}
              disabled={isLoading}
            />
            <CollapsibleSection
              title="视觉音效"
              icon="🎨"
              value={plan.assets}
              onChange={(v) => setPlan((p) => ({ ...p, assets: v }))}
              expanded={expandedSection === "assets"}
              onToggle={() => setExpandedSection(expandedSection === "assets" ? null : "assets")}
              disabled={isLoading}
            />
            <CollapsibleSection
              title="技术逻辑"
              icon="⚙️"
              value={plan.technical}
              onChange={(v) => setPlan((p) => ({ ...p, technical: v }))}
              expanded={expandedSection === "technical"}
              onToggle={() => setExpandedSection(expandedSection === "technical" ? null : "technical")}
              disabled={isLoading}
            />
            <CollapsibleSection
              title="背景音乐"
              icon="🎵"
              value={plan.music}
              onChange={(v) => setPlan((p) => ({ ...p, music: v }))}
              expanded={expandedSection === "music"}
              onToggle={() => setExpandedSection(expandedSection === "music" ? null : "music")}
              disabled={isLoading}
            />
            <CollapsibleSection
              title="数值调校"
              icon="🎚️"
              value={plan.balance}
              onChange={(v) => setPlan((p) => ({ ...p, balance: v }))}
              expanded={expandedSection === "balance"}
              onToggle={() => setExpandedSection(expandedSection === "balance" ? null : "balance")}
              disabled={isLoading}
            />
          </div>
        </div>

        <div className="flex flex-col bg-zinc-950/50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800/50 bg-zinc-900/30">
            <span className="text-sm text-zinc-400">
              {showMiniGame && isLoading
                ? "边玩边等待..."
                : showMiniGame && gameReady
                ? "修改完成！点击查看"
                : previewHtml
                ? "游戏预览"
                : "等待生成..."}
            </span>
            {isLoading && (
              <span className="text-xs text-emerald-400 flex items-center gap-1">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                {phase === "plan" ? "生成策划中" : isTweaking ? "微调中" : isSynthesizingBgm ? "合成语音中" : "生成游戏中"}
              </span>
            )}
            {gameReady && showMiniGame && (
              <span className="text-xs text-yellow-400 flex items-center gap-1 animate-pulse">
                ✨ 修改完成
              </span>
            )}
          </div>

          <div className="flex-1 relative">
            {showMiniGame ? (
              <WaitingMiniGame gameReady={gameReady} onViewGame={handleViewGeneratedGame} />
            ) : previewHtml ? (
              <iframe
                title="game-preview"
                className="w-full h-full bg-white"
                sandbox="allow-scripts allow-same-origin allow-pointer-lock"
                srcDoc={previewHtml}
              />
            ) : (
              <div className="flex items-center justify-center h-full text-zinc-600">
                <div className="text-center">
                  <div className="text-6xl mb-4">🎮</div>
                  <p>输入创意，点击生成</p>
                </div>
              </div>
            )}
          </div>

          {previewHtml && !showMiniGame && (
            <div className="border-t border-zinc-800/50 bg-zinc-900/30 p-3 space-y-3">
              {/* 微调区域 */}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={tweakRequest}
                  onChange={(e) => setTweakRequest(e.target.value)}
                  disabled={isLoading || isGeneratingVideo || isSynthesizingBgm}
                  placeholder="输入修改需求，如：把背景改成蓝色、让敌人移动更慢、增加生命值..."
                  className="flex-1 rounded-lg border border-zinc-700/50 bg-zinc-800/50 px-3 py-2 text-sm outline-none placeholder:text-zinc-600 focus:border-amber-500 disabled:opacity-50"
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
                  className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-amber-400 transition whitespace-nowrap"
                >
                  {isTweaking ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      微调中
                    </span>
                  ) : (
                    "微调游戏 ✨"
                  )}
                </button>
              </div>

              {/* 视频生成区域 */}
              <div className="flex items-center gap-2 pt-2 border-t border-zinc-800/30">
                <button
                  type="button"
                  disabled={
                    !plan.lore?.trim() || !previewHtml?.trim() || isLoading || isGeneratingVideo || isSynthesizingBgm
                  }
                  onClick={handleGenerateVideo}
                  className="rounded-lg bg-purple-500 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-purple-400 transition whitespace-nowrap"
                >
                  {isGeneratingVideo ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      生成中
                    </span>
                  ) : (
                    "🎬 生成预告片"
                  )}
                </button>
                {videoStatus && (
                  <span className="text-xs text-purple-400">{videoStatus}</span>
                )}
                {videoUrl && (
                  <a
                    href={videoUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-emerald-400 hover:underline"
                  >
                    🎥 查看视频
                  </a>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-zinc-800/30">
                <button
                  type="button"
                  disabled={!previewHtml || !plan.music?.trim() || isLoading || isSynthesizingBgm}
                  onClick={handleSynthesizeBgm}
                  className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed hover:bg-violet-500 transition whitespace-nowrap"
                >
                  {isSynthesizingBgm ? (
                    <span className="flex items-center gap-2">
                      <LoadingSpinner />
                      GLM-TTS 合成中…
                    </span>
                  ) : (
                    "🎙️ 合成/重嵌背景语音"
                  )}
                </button>
                <span className="text-xs text-zinc-500">
                  生成游戏时已按策划「背景音乐」自动嵌入；若你改写了朗读稿，点此重新合成并嵌入（循环播放，点按页面可触发播放）
                </span>
              </div>

              <p className="text-xs text-zinc-600">
                提示：微调会保留游戏主体 | 预告片基于世界观 | 语音为 TTS 朗读氛围稿，非纯器乐 BGM
              </p>
            </div>
          )}
        </div>
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

function CollapsibleSection({
  title,
  icon,
  value,
  onChange,
  expanded,
  onToggle,
  disabled,
}: {
  title: string;
  icon: string;
  value: string;
  onChange: (v: string) => void;
  expanded: boolean;
  onToggle: () => void;
  disabled: boolean;
}) {
  const hasContent = value.replace(/\u00a0/g, " ").trim().length > 0;

  return (
    <div className="rounded-lg border border-zinc-700/50 bg-zinc-800/30 transition-colors">
      <button
        type="button"
        onClick={onToggle}
        disabled={disabled}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left disabled:opacity-50"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2 text-sm font-medium text-zinc-100 flex-nowrap">
          <span className="shrink-0">{icon}</span>
          <span className="min-w-0 shrink truncate">{title}</span>
          {hasContent ? (
            <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" aria-hidden />
          ) : null}
        </span>
        <svg
          className={`h-4 w-4 shrink-0 text-zinc-500 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-700/40 px-3 pb-3 pt-2">
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="min-h-40 w-full rounded-md border border-zinc-700/50 bg-zinc-900/50 p-2.5 text-xs leading-relaxed text-zinc-200 outline-none placeholder:text-zinc-600 focus:border-indigo-500/80 focus:ring-1 focus:ring-indigo-500/20 resize-y disabled:opacity-50"
            placeholder={`在此编辑${title}...`}
          />
        </div>
      )}
    </div>
  );
}

function WaitingMiniGame({ gameReady, onViewGame }: { gameReady: boolean; onViewGame: () => void }) {
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
    <div className="relative w-full h-full flex items-center justify-center bg-zinc-900">
      <canvas
        ref={canvasRef}
        width={800}
        height={500}
        className="rounded-lg shadow-2xl max-w-full max-h-full"
        style={{ imageRendering: "pixelated" }}
      />
      
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
