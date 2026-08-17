# 续言 Continuum · GUI 设计规范

*文档版本：v1.0（与高保真原型同步）*
*创建时间：2026-08-12*
*依据：《GUI设计优化与迭代策划方案》v1.0*
*配套交付物：`design/GUI高保真原型.html`（可交互原型）、`design/GUI交互逻辑文档.md`*

> **落地状态（2026-08-14）**：本规范已由 `desktop/`（Electron + React + Tailwind）全量落地——
> Primitive/Semantic Tokens 映射为 [tailwind.config.ts](../desktop/tailwind.config.ts) 主题与
> [globals.css](../desktop/src/renderer/src/styles/globals.css) 的 CSS 变量；主题矩阵（浅/深/护眼浅/护眼深/高对比）
> 已在 M5 实现。2026-08-14 追加落地：侧栏四 Tab 创作知识、AI 知识库 Tab（RAG 检索列表）等界面。
> 本文档作为长期设计规范保留；设计项与实现状态对照见 [docs/项目设计文档.md](../docs/项目设计文档.md#11-策划--实现对照)。

---

## 目录

- [1. 设计原则](#1-设计原则)
- [2. Design Tokens 体系](#2-design-tokens-体系)
  - [2.1 Token 架构](#21-token-架构)
  - [2.2 Primitive Tokens（原子层）](#22-primitive-tokens原子层)
  - [2.3 Semantic Tokens（语义层）](#23-semantic-tokens语义层)
  - [2.4 Component Tokens（组件层）](#24-component-tokens组件层)
- [3. 主题系统](#3-主题系统)
- [4. 字体规范](#4-字体规范)
- [5. 图标系统](#5-图标系统)
- [6. 组件库规范](#6-组件库规范)
- [7. 间距 / 圆角 / 阴影 / 动效](#7-间距--圆角--阴影--动效)
- [8. 布局与栅格](#8-布局与栅格)
- [9. 响应式与高 DPI 适配](#9-响应式与高-dpi-适配)
- [10. 无障碍规范（a11y）](#10-无障碍规范a11y)
- [11. 品牌规范](#11-品牌规范)
- [12. 规范落地指引（desktop 实现映射）](#12-规范落地指引desktop-实现映射)

---

## 1. 设计原则

续言是「面向中文网文作者的沉浸式写作工具」。GUI 设计遵循四条原则，贯穿全部规范：

| 原则 | 内涵 | 落地表现 |
| --- | --- | --- |
| **主体突出** | 创作内容永远是视觉中心 | 中央编辑区占最大面积，侧栏与面板可一键折叠 |
| **纸稿沉浸** | 还原「下笔落墨」的纸笔感 | 正文衬线字体 + 首行缩进 + 低干扰浅色/护眼底 |
| **辅助收敛** | 工具在需要时才出现 | AI / 大纲 / 角色等按需召唤，默认折叠为图标条 |
| **反馈即时** | 每一次操作都有可见反馈 | Toast / 状态栏 / 动效三层反馈体系 |

> 体验基准对照（策划方案 §1.4）：低饱和、高留白、线性图标、8px 节奏网格、平面化阴影。

---

## 2. Design Tokens 体系

### 2.1 Token 架构

```
Primitive Tokens（原子层）   颜色/字体/字号/间距/圆角/阴影/动效
        ↓ 语义映射
Semantic Tokens（语义层）    bg / text / border / accent / status / focus
        ↓ 主题映射
Component Tokens（组件层）   按钮 / 输入框 / 卡片 / 列表项 / 弹窗 / Toast / 状态栏
        ↓ 控件实现
CSS 变量 + Tailwind（desktop 实现，见 §12 映射表）
```

**铁律**：任何界面代码不得直接引用原子色值（`#2D7FF9` 等），必须经语义层取值。违例计入视觉走查（目标覆盖率 ≥ 95%，见合规校验文档）。

### 2.2 Primitive Tokens（原子层）

#### 颜色

| Token | 浅色 | 深色 | 用途 |
| --- | --- | --- | --- |
| `--brand-500` | `#2D7FF9` | `#4F8CFF` | 主品牌色 / 强调色 |
| `--brand-300` | `#7AB1FF` | `#7AB1FF` | 品牌浅态（hover / 渐变末端） |
| `--brand-50` | `#EBF3FF` | `#1C2B47` | 品牌选中底 / 浅色提示 |
| `--neutral-0` | `#FFFFFF` | `#1A1D24` | 画布 |
| `--neutral-50` | `#F7F8FA` | `#22262F` | 一级表面（工具栏 / 面板 / 侧栏） |
| `--neutral-100` | `#EEF1F5` | `#2B303B` | 二级表面（卡片 / 输入底） |
| `--neutral-200` | `#E2E6EC` | `#373D49` | 分割线 / 边框 |
| `--neutral-300` | `#CBD2DC` | `#4A5260` | 强边框 / 悬停块 |
| `--neutral-500` | `#8A92A1` | `#9098A6` | 次要文本 / 图标静默态 |
| `--neutral-700` | `#4A5160` | `#B4BAC6` | 正文辅助文本 |
| `--neutral-900` | `#1A1D24` | `#E6E8EC` | 主要文本 |
| `--success-500` | `#22C55E` | `#22C55E` | 成功状态 |
| `--warning-500` | `#F59E0B` | `#F59E0B` | 警告状态 |
| `--danger-500` | `#EF4444` | `#EF4444` | 错误状态 |

#### 字体 / 字号 / 字重 / 间距 / 圆角 / 阴影 / 动效

| 类别 | Token 集合 |
| --- | --- |
| 字体 | `--font-ui`（Inter + 苹方/微软雅黑）、`--font-prose`（思源宋体 + Noto Serif CJK + 宋体栈）、`--font-mono`（JetBrains Mono / Cascadia / Consolas） |
| 字号 | `--fs-xs 11px / sm 12px / base 14px / lg 16px / xl 18px / 2xl 22px / 3xl 28px` |
| 字重 | `--fw-regular 400 / medium 500 / semibold 600 / bold 700` |
| 间距 | `--space-1 4px / 2 8px / 3 12px / 4 16px / 6 24px / 8 32px / 12 48px`（8px 基准节奏） |
| 圆角 | `--radius-sm 4px / md 6px / lg 10px / full 9999px` |
| 阴影 | `--shadow-1`（极浅，列表项）、`--shadow-2`（浮层）、`--shadow-3`（弹窗 / 命令面板） |
| 动效 | `--ease-standard cubic-bezier(.4,0,.2,1)`、`--dur-fast 120ms / base 200ms / slow 320ms` |

### 2.3 Semantic Tokens（语义层）

| Token | 浅色映射 | 深色映射 | 说明 |
| --- | --- | --- | --- |
| `--bg-canvas` | neutral-0 | neutral-0(dark) | 主画布（编辑区外背景） |
| `--bg-surface` | neutral-50 | neutral-50(dark) | 工具栏 / 面板 / 侧栏 / 状态栏 |
| `--bg-raised` | neutral-100 | neutral-100(dark) | 卡片 / 输入底 / 开关轨道 |
| `--bg-hover` | neutral-100 | #2E3440 | 悬停底 |
| `--bg-active` | neutral-200 | #38404E | 按下底 |
| `--bg-selected` | brand-50 | brand-50(dark) | 选中项底（带品牌倾向） |
| `--editor-bg` | #FDFDFD | #1D2129 | 编辑区纸面底色 |
| `--text-primary` | neutral-900 | neutral-900(dark) | 主文本 |
| `--text-secondary` | neutral-500 | neutral-500(dark) | 次要文本 |
| `--text-tertiary` | neutral-300 | neutral-300(dark) | 弱文本 / 占位 |
| `--text-on-brand` | #FFFFFF | #FFFFFF | 品牌按钮文字 |
| `--border-default` | neutral-200 | neutral-200(dark) | 常规边框 |
| `--border-strong` | neutral-300 | neutral-300(dark) | 强边框（开关轨道） |
| `--accent-default` | brand-500 | brand-500(dark) | 品牌强调 |
| `--accent-hover` | brand-300 | brand-300 | 强调悬停 |
| `--focus-ring` | brand-500 @ 35% | 同左 | 焦点环 |
| `--status-success/warning/danger` | 对应色 | 对应色 | 状态色 |
| `--overlay` | rgba(26,29,36,.42) | rgba(0,0,0,.55) | 浮层遮罩 |

### 2.4 Component Tokens（组件层）

每个组件由语义层解析出局部变量（示意）：

```css
/* 按钮（primary） */
--btn-primary-bg: var(--accent-default);
--btn-primary-fg: var(--text-on-brand);
--btn-primary-hover: var(--accent-hover);
--btn-primary-radius: var(--radius-md);

/* 输入框 */
--input-bg: var(--bg-raised);
--input-border: var(--border-default);
--input-focus-border: var(--accent-default);
--input-radius: var(--radius-md);

/* 侧栏列表项 */
--tree-item-hover: var(--bg-hover);
--tree-item-selected: var(--bg-selected);
--tree-item-selected-fg: var(--accent-default);
--tree-item-radius: var(--radius-sm);
```

desktop 落地时组件 Token 以 CSS 变量 + Tailwind 组件类实现（见 §12 映射表）。

---

## 3. 主题系统

| 主题 | 色板要点 | 场景 | 高对比开关 |
| --- | --- | --- | --- |
| **浅色**（默认） | neutral-0 画布 + brand-500 强调 + 宋体正文 | 白天 / 校对 | 关 |
| **深色**（默认） | neutral-0(dark) 画布 + brand-500(dark) 强调 | 夜间长篇码字 | 关 |
| **护眼浅** | 米黄底 `#F5EFE0` + 暖色文本 `#4A3F2F` + 宋体正文 | 长时间阅读 | 关 |
| **护眼深** | 深褐底 `#1F1A17` + 暖色文本 `#E0D6C8` + 宋体正文 | 夜间护眼 | 关 |
| **高对比** | 纯黑底 / 纯白底 + 高亮文本 + 2px 强边框 | 视障辅助 | 开 |

**主题切换规则**：

- 切换入口：顶栏主题按钮（`Ctrl+Alt+T` 循环）、命令面板、设置 → 外观、格式设置弹窗；
- 切换动画：背景与文字颜色过渡 `200ms ease-standard`；
- 状态持久化：主题选择写入 `config/window_state.json`，下次启动恢复；
- 扩展机制：新增主题 = 新增一个调色板 dict，无需改动任何控件代码。

**护眼 / 高对比色板说明**：本规范列出语义目标值，具体色值在 P1 阶段结合原型的护眼（浅/深）与高对比主题补充二次校准（对比度须达 WCAG 2.1 AA，见合规校验文档 §3.4）。

---

## 4. 字体规范

| 用途 | 字体栈 | 应用区域 |
| --- | --- | --- |
| UI 字体 | `Inter, "PingFang SC", "Microsoft YaHei", sans-serif` | 菜单 / 按钮 / 侧栏 / 状态栏 / 面板 |
| 正文（编辑 + 预览） | `"Source Han Serif SC", "Noto Serif CJK SC", "Songti SC", "SimSun", serif` | 编辑区 / 预览区 / 欢迎卡标题 |
| 等宽 | `"JetBrains Mono", "Cascadia Code", Consolas, monospace` | 代码块 / 快捷键 / 数字统计 |

**规范要点**：

1. 编辑区默认字号 **16px**，行距 **1.9**，段距 14px，首行缩进 **2 字符**（`text-indent: 2em`）；
2. 章节标题 22px bold，正文一级标题 17px bold；
3. 字号可在「设置 → 编辑器」六档切换：12 / 14 / 16 / 18 / 20 / 24；
4. 打包策略：思源宋体与 Inter 做子集化（仅常用字重），随应用分发，避免依赖系统字体；
5. 中文文本一律使用全角标点，西文与数字使用半角（`--font-prose` 处理中西文混排）；
6. 不引入任何非 OFL / 非宽松协议字体（合规要求，见合规校验文档）。

---

## 5. 图标系统

| 维度 | 规范 |
| --- | --- |
| 风格 | 线性 1.5–1.8px 描边，圆角端点，关键图标双态（线性 / 填充） |
| 尺寸 | 16px（工具栏 / 树节点）/ 20px（Tab / 按钮）/ 24px（大按钮 / 空状态） |
| 格式 | SVG（`viewBox 24x24`），`stroke="currentColor"` 保证主题联动 |
| 命名 | `icon-<domain>-<name>`，如 `icon-editor-bold`、`icon-ai-sparkle` |
| 库 | 自研 60+ 核心图标（高保真原型已实现 30+）+ Lucide（MIT）精选扩充 |
| 语义 | 图标必须配 `aria-label` / `accessibleName`；纯装饰图标设置 `decorative` |

**首批图标清单**（高保真原型已落地）：编辑（bold/italic/underline/heading/quote/list-ul/list-ol/task/table/link/image/code/undo/redo）、内容（work/outline/character/world/clue/material）、AI（sparkle/polish/continue/kb-search）、通用（search/save/bell/command/theme/immersive/help/export/import/check/close）。

**禁止**：不使用 emoji 作为功能图标（跨平台渲染不一致、无障碍缺失）；不混用多种线性风格。

---

## 6. 组件库规范

### 6.1 按钮

| 变体 | 背景 | 文字 | 边框 | 圆角 | 场景 |
| --- | --- | --- | --- | --- | --- |
| Primary | accent-default | #FFF | 同背景 | md | 主操作（发送 / 创建 / 应用） |
| Default | bg-canvas | text-primary | border-default | md | 次级操作 |
| Ghost | 透明 | text-secondary | 无 | md | 辅助操作（取消 / 关闭） |
| Danger | danger-500 | #FFF | 同背景 | md | 破坏性操作（删除） |
| 图标按钮 | 透明 | text-secondary | 无 | md | 工具栏 / 面板工具 |
| Ghost 虚线 | 透明 | accent-default | dashed accent | md | 空状态「+ 新建」 |

尺寸：高 28px（工具栏）/ 32px（常规）/ 36px（弹窗主按钮）；内边距 `7px 16px`。

交互：hover 背景 `bg-hover`（Primary hover 为 accent-hover）、按下 `bg-active`、focus 显示 focus-ring、`disabled` 用 border-strong + 60% 透明度。

### 6.2 输入框 / 搜索框 / 下拉

- 输入框：底 `bg-raised` 或 `bg-canvas`，边框 `border-default`，radius-md，聚焦时 `border-color: accent-default` + `focus-ring`（3px 外发光）；
- 搜索框：高度 30px，左侧 14px 放大镜图标，内部输入无边框；
- 下拉：底 `bg-canvas`，radius-sm，箭头为 chevron-down 图标；
- 文本域（AI 输入）：radius-lg，聚焦同输入框，最大高度 96px，可滚动。

### 6.3 列表 / 树

- 树节点：高 28px，radius-sm，hover `bg-hover`，选中 `bg-selected` + 文字 accent-default；展开箭头 12px chevron（展开向下 / 收起旋转 -90°，200ms）；
- 子级缩进 14px + 1px 左边框竖线；
- 右侧元信息（字数 / 状态）11px text-tertiary，状态 tag 为 10px pill（成功/警告/品牌色）；
- 角色卡：卡片式（radius-md + border），hover 边框变 accent + shadow-1；头像 34px 圆形渐变底 + 首字；
- 空状态：44px 圆形品牌底图标 + 标题 + 说明 + Ghost 虚线按钮。

### 6.4 工具栏 / Tab / 菜单

- 顶栏：高 42px，bg-surface，底部 1px 边框；菜单项 12px 文字，hover bg-hover，radius-sm；
- 侧栏 Tab：高 32px，选中态下划线 2px accent（左右 12%）；AI Tab 高 30px 同规则；
- 模式切换（编辑/预览/源码）：胶囊容器 bg-raised，选中项 bg-canvas + shadow-1；
- 上下文菜单 / 命令面板：radius-lg + shadow-3 + 200ms popIn（translateY -8px + scale .98）。

### 6.5 弹窗 / 浮层 / Toast / 通知

| 组件 | 尺寸 | 遮罩 | 动画 | 反馈层级 |
| --- | --- | --- | --- | --- |
| 命令面板 | 560px 宽，顶部 12vh | overlay | popIn 200ms | 模态 |
| 对话框（向导 / 设置） | 480px（设置 720px） | overlay | popIn 200ms | 模态 |
| Diff 微浮窗 | 620px，贴选区下方 | 无遮罩 | popIn 200ms | 非模态浮层 |
| 通知中心 | 340px，顶右抽屉 | 无遮罩 | slideDown 200ms | 非模态抽屉 |
| Toast | 自适应，顶部居中 | 无 | slideDown + 淡出 | 3s 自动消失 |
| 快捷键速查 | 680px | overlay | popIn | 模态 |

Toast 规范：成功（绿✓）/ 信息（蓝i）/ 警告（黄!）/ 错误（红✕）四类，右上角 16px 圆形浅色底图标 + 14px 文案，默认 2.6s 自动消失，支持手动关闭；同一时间最多 3 条，超出滚动合并。

### 6.6 状态栏 / 面包屑

- 状态栏：高 30px，bg-surface，11px text-secondary；左半为信息组（字数/字符/今日/目标进度/模型），右半固定（自动保存时间/编码/格式/版本）；目标进度条 90×4px 胶囊，填充品牌渐变；
- 面包屑：高 34px，bg-canvas，11px；当前章节加粗（text-primary）；右侧保存状态用成功绿 ✓ + 「已保存 HH:MM:SS」。

---

## 7. 间距 / 圆角 / 阴影 / 动效

**间距节奏（8px 基准）**：4 / 8 / 12 / 16 / 24 / 32 / 48。

| 位置 | 间距 |
| --- | --- |
| 面板内边距 | 12–16px |
| 卡片间距 | 8–12px |
| 编辑区页边距 | 32px（左） + 32px（右）+ 底部 40vh 呼吸 |
| 工具栏元素间距 | 4px（元素）/ 12px（分区）/ 1px 分隔线 + 12px margin |
| 弹窗内边距 | 20px 左右，16px 上下 |

**圆角**：按钮/输入 6px，卡片 6–10px，弹窗 10px，头像/胶囊 9999px。

**阴影**：默认平面化；hover 用 shadow-1；浮层 shadow-2；弹窗/命令面板 shadow-3。深色主题阴影加深（alpha 提高）。

**动效时长**：微交互 120ms，面板/抽屉 200ms，主题过渡 200ms，大弹窗 320ms。全部使用 `cubic-bezier(.4,0,.2,1)`。**尊重系统减弱动效设置**（`prefers-reduced-motion`）。

---

## 8. 布局与栅格

### 8.1 默认三栏骨架（1280×820 基准）

```
┌───────────────────────────────────────────────────────────────┐
│ 顶栏 42px（品牌 + 极简菜单 + 全局工具按钮）                      │
├───────────────────────────────────────────────────────────────┤
│ 面包屑 34px（作品▸卷▸章节 + 保存状态 + 今日字数）                 │
├─────┬─────────────────────────────────────┬───────────────────┤
│     │ 格式工具栏 40px                      │                   │
│ 侧栏 │                                     │ 右侧 AI 面板       │
│ 280px│ 编辑区（编辑即预览 / 预览 / 源码）   │ 340px             │
│     │                                     │ （可折叠 48px）    │
│ 可折叠 48px                              │                   │
├─────┴─────────────────────────────────────┴───────────────────┤
│ 状态栏 30px                                                   │
└───────────────────────────────────────────────────────────────┘
```

### 8.2 展收逻辑

| 区域 | 默认 | 折叠方式 | 沉浸模式 |
| --- | --- | --- | --- |
| 顶栏 | 显 | 不可折叠 | 隐藏 |
| 面包屑 | 显 | — | 隐藏 |
| 格式工具栏 | 显 | 沉浸模式隐藏 | 隐藏 |
| 左侧栏 | 显 | 折叠为 48px 图标条（双击 Tab 区触发） | 隐藏 |
| 右 AI 面板 | 显（340px） | 折叠为 48px 图标条 | 隐藏 |
| 状态栏 | 显 | — | 隐藏 |

### 8.3 栅格规则

- 编辑区内容最大宽度 760px 居中，两侧留白自适应（长行文本更易阅读）；
- 组件尺寸与间距必须落于 8px 网格（圆角除外）；
- 窗口最小尺寸 1024×720（低于则触发「极简码字」态：隐藏侧栏与 AI 面板，保留单栏编辑区）。

---

## 9. 响应式与高 DPI 适配

| 断点 | 行为 |
| --- | --- |
| ≥ 1440px | 全功能布局（三栏全开） |
| 1024–1439px | 编辑区优先扩展；AI 面板默认折叠为图标条 |
| < 1024px（最小 800×600） | 侧栏 220px、AI 面板 300px；编辑区保持单栏可写 |
| 沉浸模式 | 仅编辑区 + 悬浮工具条（鼠标悬停顶部 100px 触发） |

- **高 DPI**：Electron/Chromium 默认启用高分屏适配，1.0/1.25/1.5/2.0 缩放全量走查；
- **窗口状态持久化**：位置 / 尺寸 / 主题 / 折叠状态等写入 `desktop/data/settings.json`；
- **字体自适应**：编辑区字号随 DPI 同步缩放，行距保持比例。

---

## 10. 无障碍规范（a11y）

1. **键盘可达**：全部功能可纯键盘完成；焦点环统一 `focus-ring`；Tab 顺序遵循视觉顺序（顶栏 → 侧栏 → 编辑区 → AI 面板 → 状态栏）；
2. **语义标注**：所有控件设置 `accessibleName`，复杂控件补充 `accessibleDescription`；图标按钮必带名称；纯装饰图形标记 decorative；
3. **对比度**：正文文本 ≥ 4.5:1，大字号/粗体 ≥ 3:1（WCAG 2.1 AA），状态色在深色下校验后使用；
4. **动效克制**：遵循系统「减少动态效果」偏好；
5. **辅助能力**：支持 `Ctrl+=/-` 字号缩放；提供高对比主题；AI 输出气泡支持「朗读」按钮（联动 TTS）；
6. **焦点管理**：命令面板 / 弹窗打开时焦点移入，关闭后归还触发点（focus trap 于模态弹窗内）。

---

## 11. 品牌规范

| 项 | 规范 |
| --- | --- |
| LOGO | 24px 圆角方块（radius 6px），蓝紫渐变（135deg brand-500 → #5A9DFF），内嵌「笔锋」线性图形（高保真原型顶部已实现） |
| 品牌字 | 「续言」中文名 + `Continuum` 英文（UI 中为「续言 Continuum」组合，英文部分用 text-secondary） |
| 品牌色 | 全局唯一主色 `brand-500`，渐变仅用于 LOGO / 头像 / 进度条，不用于大面积背景 |
| 启动画面 | 欢迎空状态卡：左 1/3 品牌插画卡（LOGO + 品牌语 + 特性），右 2/3 三个入口卡片 |
| 文案基调 | 克制、文人气质；品牌语「让故事接续、延续下去」仅出现于欢迎卡与关于页 |

**品牌语**：*「续言 / Continuum」—— 让故事接续、延续下去。*

---

## 12. 规范落地指引（desktop 实现映射）

| 设计 Token | desktop（Electron + React + Tailwind）实现 |
| --- | --- |
| Primitive Tokens | `desktop/src/renderer/src/styles/globals.css`（CSS 变量，`:root` 与 `[data-theme]` 主题矩阵） |
| Semantic Tokens | `desktop/tailwind.config.ts`：`colors.brand/neutral/status` 映射为 `var(--*)` |
| 组件 Tokens | `globals.css` `@layer components`：`btn-primary` / `btn-default` / `icon-btn` / `top-menu-btn` |
| 主题管理 | `desktop/src/renderer/src/stores/uiStore.ts`（ThemeId 矩阵 + 持久化）+ `html[data-theme]` 切换 |
| 字体 | `tailwind.config.ts` `fontFamily`：`font-ui` / `font-prose`（思源宋体衬线栈）/ `font-mono` |
| 图标 | `desktop/src/renderer/src/components/Icon.tsx`（SVG path 组件） |
| 顶栏 / 面包屑 / 状态栏 | `components/Header.tsx` / `components/StatusBar.tsx` |
| 侧栏多 Tab | `components/Sidebar.tsx`（作品/大纲/角色/设定/伏笔/素材 + 搜索 + 折叠） |
| AI 面板 | `components/AIPanel.tsx`（对话/润色/续写/知识库四 Tab + 流式气泡 + 操作行） |
| 命令面板 | `components/CommandPalette.tsx`（Ctrl+K，模糊过滤 + 键盘导航） |
| 通知中心 / Toast | `stores/toastStore.ts` + `components/ToastViewport.tsx` |
| 沉浸模式 | `App.tsx`（immersed 状态 + 悬浮胶囊） |
| 窗口状态持久化 | `desktop/src/main/index.ts`（窗口几何保存/恢复）+ `stores/uiStore.ts` |

---

*本规范已由 desktop 全量落地并通过 M0–M7 验收与后续增量（typecheck / 62 项单测 / 生产构建；2026-08-14 基线）。*

*「续言 / Continuum」—— 让故事接续、延续下去。*
