## Why

当前 Game Weaver 界面全程采用深色主题（dark theme），在明亮环境下辨识度差，长时间使用容易造成视觉疲劳。用户需要一套干净的白色/浅色界面，提升可读性与专业感，同时保留信息层级清晰的设计语言。

## What Changes

- 将全局背景从深色（`#0b0d10` 等）切换为白色/浅灰系
- 将文字颜色从浅色切换为深色系，确保 WCAG AA 级对比度
- 将边框色从暗色调整为中性浅色
- 按钮配色保持品牌色（indigo、emerald、amber），仅在浅色背景下微调饱和度
- 等待小游戏（canvas）区域从深色切换为浅色背景
- 移除 `prefers-color-scheme: dark` 媒体查询，强制使用浅色模式
- 错误、成功等语义色在浅色背景下重新校准

## Capabilities

### New Capabilities
- `light-theme`: 全局浅色主题系统，包含背景层级、文字层级、边框色、交互态颜色的完整定义

### Modified Capabilities
<!-- 无现有 specs，不需要修改 -->

## Impact

- `app/globals.css` — 移除 dark 媒体查询，调整 CSS 变量
- `app/page.tsx` — 所有 Tailwind 颜色类名需从深色系改为浅色系（约 200+ 处）
- `app/layout.tsx` — 可能需要添加浅色主题 class
