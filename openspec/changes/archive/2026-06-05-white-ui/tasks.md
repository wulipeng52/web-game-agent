## 1. CSS 全局样式

- [x] 1.1 移除 `globals.css` 中的 `@media (prefers-color-scheme: dark)` 媒体查询块
- [x] 1.2 确认 CSS 变量 `--background` / `--foreground` 保持浅色值不变（已是 `#ffffff` / `#171717`）

## 2. 主页面框架（app/page.tsx）

- [x] 2.1 外层 `<main>` 背景从 `bg-[#0b0d10]` 切换为 `bg-white`，文字 `text-zinc-100` → `text-zinc-900`
- [x] 2.2 Header 区域：`bg-[#101318]` → `bg-white`，`border-zinc-800` → `border-zinc-200`，标题 `text-zinc-50` → `text-zinc-900`，副标题 `text-zinc-500` 保持，badge `border-emerald-500/30` 调整
- [x] 2.3 Header 按钮：清除按钮 `border-zinc-700 bg-zinc-900 text-zinc-300` → `border-zinc-300 bg-white text-zinc-600`，hover 态同步调整
- [x] 2.4 分隔线：全局 `border-zinc-800` → `border-zinc-200`

## 3. 创意输入区（左侧面板）

- [x] 3.1 面板背景 `bg-[#0f1217]` → `bg-zinc-50`
- [x] 3.2 标题文字 `text-zinc-100` → `text-zinc-800`
- [x] 3.3 Textarea：`bg-[#151922] border-zinc-800 text-zinc-100` → `bg-white border-zinc-300 text-zinc-900`，placeholder `text-zinc-600` → `text-zinc-400`，focus 保持 `border-indigo-500`
- [x] 3.4 错误消息：`border-red-900/70 bg-red-950/40 text-red-200` → `border-red-300 bg-red-50 text-red-700`
- [x] 3.5 生成按钮保持品牌色（indigo/emerald），重新生成按钮 `border-zinc-800 text-zinc-400` → `border-zinc-300 text-zinc-500`

## 4. 策划区块（右侧面板）

- [x] 4.1 面板背景 `bg-[#0c0f14]` → `bg-white`
- [x] 4.2 顶部工具栏：`text-zinc-100` → `text-zinc-800`，完成计数 badge `border-zinc-800` → `border-zinc-300`
- [x] 4.3 策划卡片非活跃态：`border-zinc-800 bg-[#141821]` → `border-zinc-200 bg-white`，hover `hover:border-zinc-700 hover:bg-[#181d27]` → `hover:border-zinc-300 hover:bg-zinc-50`
- [x] 4.4 策划卡片活跃态：`border-indigo-400 bg-indigo-500/10` → `border-indigo-500 bg-indigo-50`
- [x] 4.5 卡片文字：标题 `text-zinc-100` → `text-zinc-800`，短名 `text-zinc-500` 保持，预览文本 `text-zinc-500` → `text-zinc-400`
- [x] 4.6 卡片圆点指示器：已填写 `bg-emerald-400` → `bg-emerald-500`，未填写 `bg-zinc-700` → `bg-zinc-300`
- [x] 4.7 右侧编辑区：`border-zinc-800 bg-[#11151d]` → `border-zinc-200 bg-white`，标题 `text-zinc-100` → `text-zinc-800`，字数 badge `bg-zinc-900 text-zinc-400` → `bg-zinc-100 text-zinc-500`
- [x] 4.8 编辑区 textarea：`text-zinc-200` → `text-zinc-800`，placeholder `text-zinc-600` → `text-zinc-400`

## 5. 游戏预览区

- [x] 5.1 预览区容器 `bg-zinc-950` → `bg-white`
- [x] 5.2 预览区工具栏：`bg-[#101318]` → `bg-zinc-50`，`text-zinc-100` → `text-zinc-800`，状态 badge `border-zinc-800` → `border-zinc-300`
- [x] 5.3 保存按钮 `bg-zinc-100 text-zinc-950` → `bg-zinc-800 text-white`（浅色背景下需要有足够反差）
- [x] 5.4 空状态提示 `text-zinc-600` / `text-zinc-500` 保持（在白色背景上已足够可见）
- [x] 5.5 微调工具栏容器 `bg-[#101318]` → `bg-zinc-50`，输入框 `bg-[#151922] border-zinc-800 text-zinc-100` → `bg-white border-zinc-300 text-zinc-900`

## 6. 等待小游戏（WaitingMiniGame 组件）

- [x] 6.1 外层容器 `bg-zinc-900` → `bg-zinc-100`
- [x] 6.2 游戏选择按钮非活跃态：`border-zinc-800 bg-zinc-900 text-zinc-300` → `border-zinc-200 bg-white text-zinc-600`
- [x] 6.3 游戏选择按钮活跃态：`border-emerald-500/60 bg-emerald-500/10 text-emerald-100` → `border-emerald-500 bg-emerald-50 text-emerald-700`
- [x] 6.4 重开按钮 `border-zinc-700 text-zinc-300` → `border-zinc-300 text-zinc-600`
- [x] 6.5 Canvas 背景：`#111827` → `#f8fafc`，文字 `#f8fafc` → `#1e293b`，辅助文字 `#94a3b8` → `#64748b`
- [x] 6.6 阶段指示器非活跃态：`border-zinc-800 bg-zinc-950 text-zinc-600` → `border-zinc-200 bg-white text-zinc-400`
- [x] 6.7 阶段指示器活跃态：`border-emerald-500/50 bg-emerald-500/10 text-emerald-200` → `border-emerald-500 bg-emerald-50 text-emerald-700`
- [x] 6.8 完成弹窗背景 `bg-black/60` → `bg-black/30`，弹窗卡片 `bg-zinc-800 border-zinc-700` → `bg-white border-zinc-200`
- [x] 6.9 弹窗文字 `text-zinc-400` → `text-zinc-500`

## 7. 最终检查

- [ ] 7.1 在浏览器中打开应用，确认所有区域白底显示正常
- [ ] 7.2 测试完整的生成流程（输入创意 → 生成策划 → 生成游戏 → 微调）
- [ ] 7.3 确认交互状态（hover、focus、disabled）在各组件上表现正确
- [ ] 7.4 确认等待小游戏 canvas 在浅色背景上可正常游玩
