# Game Weaver

Game Weaver 是一个从一句话创意出发，完成「意图解析 -> 策划生成 -> 代码实施 -> 视觉增强」的网页游戏生成器。

## 功能概览

- 左侧输入一句话创意（可把期望的氛围声、旁白风格写进同一段创意），调用 `/api/generate-plan` 生成**五段式**策划案（含 **Music**）
- 可编辑各策划块（Mechanics / Lore / Assets / Technical / **Music**）
- 调用 `/api/generate-game` 生成游戏；完成后会**自动**用智谱 **GLM-TTS** 按策划 Music 朗读稿合成氛围语音并嵌入 `<audio loop>`（无需额外按钮）
- 自动解析 `Assets`，替换 `[IMAGE_PROMPT: ...]` 为图片 URL

## 1) 安装依赖

```bash
npm install
```

## 2) 配置环境变量（重要，使用智谱 + Vidu）

请不要把 Key 写在代码里，统一放入 `.env.local`：

```bash
cp .env.example .env.local
```

Windows PowerShell 可用：

```powershell
Copy-Item .env.example .env.local
```

然后编辑 `.env.local`：

```env
ZHIPU_API_KEY=your_zhipu_api_key_here
ZHIPU_TEXT_MODEL=glm-5.1
ZHIPU_CHAT_URL=https://open.bigmodel.cn/api/paas/v4/chat/completions
ZHIPU_IMAGE_MODEL=glm-image
ZHIPU_IMAGE_URL=https://open.bigmodel.cn/api/paas/v4/images/generations
ZHIPU_VIDEO_MODEL=viduq1-image
ZHIPU_VIDEO_URL=https://open.bigmodel.cn/api/paas/v4/videos/generations

# GLM-TTS（可选，背景语音）
ZHIPU_SPEECH_URL=https://open.bigmodel.cn/api/paas/v4/audio/speech
ZHIPU_TTS_MODEL=glm-tts
ZHIPU_TTS_VOICE=female
```

说明：
- `ZHIPU_API_KEY`：必填，文本/图片/视频接口共用。
- `ZHIPU_TEXT_MODEL`：默认 `glm-5.1`（可自行改为控制台中其它文本模型名）。
- `ZHIPU_IMAGE_MODEL`：默认 `glm-image`（你指定）。
- `ZHIPU_VIDEO_MODEL`：可选 `viduq1-image` 或 `vidu2-image`。

## 3) 启动开发环境

```bash
npm run dev
```

打开 [http://localhost:3030](http://localhost:3030) 访问页面。

## API

- `POST /api/generate-plan`
  - 入参：`{ "idea": "一句话创意（可内含氛围/旁白期望）" }`
  - 出参：`{ "plan": { mechanics, lore, assets, technical, music } }`

- `POST /api/generate-game`
  - 入参：`{ "plan": { mechanics, lore, assets, technical, music } }`
  - 出参：流式 SSE，结束时 `html` 为完整游戏 HTML（可能已含资源替换）

- `POST /api/generate-bgm`
  - 入参：`{ "plan": { ..., "music": "..." }, "currentHtml"?: string, "text"?: string }`（`text` 可覆盖从 music 抽取的朗读稿）
  - 出参：`{ "dataUrl": "data:audio/wav;base64,...", "html"?: "已注入 <audio id=gw-bgm> 的 HTML" }`

- `POST /api/generate-video`
  - 入参：`{ "prompt"?: string, "imageUrl"?: string, "withAudio"?: boolean, "movementAmplitude"?: "auto"|"small"|"medium"|"large", "requestId"?: string, "userId"?: string }`
  - 说明：`prompt` 和 `imageUrl` 至少一个必填
  - 出参：`{ "task": { model, id, requestId, taskStatus } }`

## 一键运行（Windows）

```powershell
Copy-Item .env.example .env.local
# 然后手动编辑 .env.local 填入真实 key
npm install
npm run dev
```

## 安全建议

- `.env.local` 已被 `.gitignore` 忽略，不会被提交。
- 建议只分享 `.env.example`，不要分享真实 Key。
