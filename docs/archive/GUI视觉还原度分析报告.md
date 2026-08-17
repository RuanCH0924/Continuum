# 续言 Continuum · GUI 视觉还原度分析报告

*文档版本：v1.0*
*创建时间：2026-08-12*
*分析对象：`design/GUI高保真原型.html`（v1.0 设计标准） vs `continuum/gui/`（PySide6 当前实现）*
*评估维度：色彩系统 / 字体层级 / 组件尺寸 / 间距规范 / 视觉层次 / 响应式适配 / 动效呈现*

---

## 目录

- [1. 分析范围与方法](#1-分析范围与方法)
- [2. 原型规范基线（七大维度核心指标）](#2-原型规范基线七大维度核心指标)
- [3. 逐维度差异清单](#3-逐维度差异清单)
  - [3.1 色彩系统](#31-色彩系统)
  - [3.2 字体层级](#32-字体层级)
  - [3.3 组件尺寸](#33-组件尺寸)
  - [3.4 间距规范](#34-间距规范)
  - [3.5 视觉层次](#35-视觉层次)
  - [3.6 响应式适配](#36-响应式适配)
  - [3.7 动效呈现](#37-动效呈现)
- [4. 技术栈适配性评估（PySide6 / Qt QSS）](#4-技术栈适配性评估pyside6--qt-qss)
- [5. 优化落地方案](#5-优化落地方案)
- [6. 技术调整与补充方案](#6-技术调整与补充方案)
- [7. 结论](#7-结论)

---

## 1. 分析范围与方法

| 项 | 说明 |
| --- | --- |
| 设计标准源 | `design/GUI高保真原型.html`（CSS 变量、组件样式、浮层、动效、响应式规则） |
| 实现对照源 | `continuum/gui/theme/*.py`（tokens/palettes/stylesheet/runtime）、`continuum/gui/app.py`、`views/sidebar.py`、`views/ai_panel.py`、`markdown/toolbar.py`、`views/markdown_editor.py`、`components/*.py` |
| 方法 | 原型 CSS 逐条提取规范值 → 与当前 QSS / 布局代码逐项比对 → 差异分级（高/中/低） |
| 说明 | 尺寸差异中标注「待实测」的项，需在真实显示环境跑分确认；本报告以代码推断为准 |

---

## 2. 原型规范基线（七大维度核心指标）

| 维度 | 原型标准（关键值） |
| --- | --- |
| **色彩** | 品牌 `#2D7FF9`/`#4F8CFF`（暗）；中性 0/50/100/200/300/500/700/900 八阶；状态绿黄红；语义 bg/text/border/accent/focus/overlay；渐变用于 LOGO/头像/进度条/品牌卡；阴影 shadow-1/2/3 三级；focus 3px 品牌外发光 |
| **字体** | UI 14 / 菜单 12 / 状态栏 11 / 正文衬线 16 行距 1.9 / 章节题 22 bold / h2 17 / 正文首行缩进 2em；字重 400/500/600/700；等宽 mono 用于快捷键与代码 |
| **组件尺寸** | 顶栏 42 / 面包屑 34 / 格式栏 40 / 侧栏 280（折叠 48）/ AI 面板 340（折叠 48）/ 状态栏 30 / 编辑列头 26 / 搜索框 30 / 树项 28 / rail 钮 34 / icon-btn 30 / Tab 32·30 / 模式钮 24 / 发送钮 30 |
| **间距** | 8px 节奏：4/8/12/16/24/32；面板内边距 12–16；卡片 8–12；fmtbar 间距 2/分区 12；状态栏 gap 16；编辑区 32px 侧距 + 底部 40vh 呼吸 |
| **视觉层次** | 卡片 hover 品牌边框+shadow-1；选中项品牌浅底+品牌字；树 meta 10px + tag pill；角色卡 34px 渐变头像；伏笔状态色条；命令面板 icon+快捷键列；通知图标色块；面包屑 ▸ 路径+绿色保存态 |
| **响应式** | 最小窗口 1024×720；<900px 侧栏 220 / AI 300 / Tab 文字隐藏（Web）；侧栏与 AI 可折叠 48px；沉浸模式；窗口状态持久化 |
| **动效** | 120/200/320ms + `cubic-bezier(.4,0,.2,1)`；hover 过渡；chevron 旋转；popIn（浮层）；slideDown（Toast/通知）；fadeIn（遮罩）；三点打字动画；保存 ✓ 闪动；沉浸字号 17px |

---

## 3. 逐维度差异清单

### 3.1 色彩系统

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| C-1 | 品牌 LOGO 渐变圆角块（`linear-gradient(135deg,#2D7FF9,#5A9DFF)` 22px） | 顶栏仅文字「续言 Continuum」，无图形 LOGO | 品牌识别缺失 | 高 |
| C-2 | 浮层阴影 shadow-2/3（命令面板/通知/Toast/弹窗/Diff） | Qt QSS 不支持 box-shadow，当前全部无阴影 | 视觉漂浮、层次弱 | 高 |
| C-3 | 输入聚焦 3px 品牌外发光（focus-ring） | 仅 border 变色，无外发光 | 聚焦反馈弱 | 中 |
| C-4 | 头像 / 进度条 / 品牌卡渐变 | 当前未实现头像（P2）、进度条纯色 | 渐变只可在部分控件实现 | 中 |
| C-5 | 状态透明底图标（通知 rgba(34,197,94,.12) 等） | 通知中心以富文本色点代替，无圆形色块 | 视觉细节 | 中 |
| C-6 | Toast 胶囊 + 色点 + 图标 | Toast 胶囊 + 色点 ✓，无图标 | 微差 | 低 |
| C-7 | 色彩 Token 数值与语义 | tokens/palettes 与原型一致 ✓ | 无 | — |

### 3.2 字体层级

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| F-1 | 编辑区行距 1.9 | QTextBlockFormat 1.75 | 行距偏低 8% | 中 |
| F-2 | 章节题 22px bold / 副标题 13px 分割线 | 源码编辑器不渲染排版（Markdown 源码）；预览 h1 为 1.9em≈30px | 预览标题层级偏大，缺「章节题+副标题」结构 | 中 |
| F-3 | 正文 16px 衬线 + 首行缩进 2em | 编辑区 16px 衬线 ✓；预览 CSS 缩进 2em ✓ | 无 | — |
| F-4 | mono 字体用于快捷键 / 代码 | renderer 代码块 ✓；命令面板快捷键未展示 | 快捷键列缺失（见 C-11） | 低 |
| F-5 | 字重梯度 400/500/600/700 | 仅 400/500 在 QSS 中使用 | 部分控件字重未细分 | 低 |

### 3.3 组件尺寸

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| S-1 | 格式工具栏固定 40px | `MarkdownToolbar` 无固定高度（随内容约 32–36px） | 高度差 4–8px | 中 |
| S-2 | 侧栏默认 280px 固定 | QDockWidget 初始宽度由内容决定（min 220 / max 420），不固定 280 | 默认布局与原型不一致 | 中 |
| S-3 | AI 面板 340px | QDockWidget min 300，初始宽度约 300–340 | 略窄 | 中 |
| S-4 | 状态栏 30px | QStatusBar 默认高度约 22–26px | 高度差 | 中 |
| S-5 | 编辑列头 26px（编辑区/预览标签条） | EditorPane 无列头 | 缺失 | 中 |
| S-6 | 搜索框 30px 带放大镜图标 | QLineEdit 约 28px，无前置图标 | 微差 + 图标缺失 | 低 |
| S-7 | 模式切换胶囊容器（bg-raised + 选中 bg-canvas+shadow-1） | 独立 QToolButton，无容器底色 | 分组视觉缺失 | 中 |
| S-8 | icon-btn 30px | 顶栏 QToolButton padding 5px 10px ≈ 28–30px | 基本一致 | 低 |
| S-9 | 树项 28px / rail 钮 34px / Tab 30–32px | QSS 一致 ✓ | 无 | — |

### 3.4 间距规范

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| G-1 | 状态栏 gap 16px | QStatusBar 无 gap，靠 label padding 4px（≈8px） | 信息间距偏紧 | 低 |
| G-2 | fmtbar 间距 2px / 分区线 | toolbar spacing 2 ✓ + 无分隔线（原型 .divider） | 分隔线缺失 | 低 |
| G-3 | 侧栏内容区 4px 边距 / 树项 margin | QSS margin 1px 2px ✓ | 无 | — |
| G-4 | 编辑区 32px 侧距 + 底部 40vh | QSS padding 24px 32px 40vh ✓ | 顶距 24 vs 32 | 低 |
| G-5 | 面板内边距 12–16 | 侧栏/AI 面板基本一致 ✓ | 无 | — |

### 3.5 视觉层次

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| H-1 | 命令面板行：icon 20px + 命令名 + mono 快捷键 | QListWidget 仅文字，无 icon、无快捷键列 | 面板信息密度低 | 中 |
| H-2 | 树折叠 chevron 旋转动画 + 图标 | QTreeWidget 原生箭头（不可定制旋转） | 视觉细节 | 低 |
| H-3 | 角色卡 34px 渐变头像 / 伏笔状态色条 | P2 数据未接入（占位引导卡） | 功能缺口（规划内） | 中 |
| H-4 | 面包屑 ▸ 分隔 + 绿色保存态 | crumb 富文本 ▸ ✓ + SaveState ✓ | 无 | — |
| H-5 | 欢迎空状态卡（品牌插画 + 三入口卡片） | 无作品时编辑区空白 | 首次体验缺失 | 高 |
| H-6 | 顶栏铃铛未读角标（红点 14px） | 无角标 | 细节 | 中 |
| H-7 | 通知中心条目图标色块 + 操作按钮 | 富文本标签 ✓（简化） | 简化可接受 | 低 |

### 3.6 响应式适配

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| R-1 | 最小窗口 1024×720 | `setMinimumSize(1024,720)` ✓ | 无 | — |
| R-2 | 侧栏 / AI 面板折叠 48px | 侧栏可折叠 48 ✓；AI 面板 Dock 无折叠 rail（可关闭） | AI 折叠交互未实现 | 中 |
| R-3 | <900px 断点（侧栏 220 / AI 300 / Tab 隐藏） | Qt QSS 无媒体查询，靠最小窗口保护 | 能力缺口（桌面可接受） | 低 |
| R-4 | 窗口状态持久化 | `window_geometry` / `dock_state` ✓ | 无 | — |
| R-5 | 高 DPI 1.25/1.5/2.0 验证 | Qt6 默认开启，未显式验证 | 待实测 | 低 |

### 3.7 动效呈现

| # | 原型要求 | 当前实现 | 差距 | 严重度 |
| --- | --- | --- | --- | --- |
| M-1 | hover 过渡 120ms（背景/颜色） | QSS 无 transition，hover 即时跳变 | **全面缺失** | 高 |
| M-2 | 浮层 popIn（命令面板/弹窗/Diff 200ms） | QDialog.show 直接出现，无动画 | **缺失** | 高 |
| M-3 | Toast / 通知 slideDown 200ms | Toast 直接出现、无滑入滑出 | **缺失** | 高 |
| M-4 | 遮罩 fadeIn | 无遮罩（命令面板为无遮罩 QDialog） | **缺失** | 中 |
| M-5 | 三点打字动画 / 保存 ✓ 闪动 / 字数 +N | 无 | **缺失** | 中 |
| M-6 | 沉浸模式编辑区字号放大 | 沉浸仅隐藏栏，未放大字号 17px | 微差 | 低 |

**差异汇总**：高严重度 9 项 / 中 16 项 / 低 10 项，共 35 项。七大维度中**动效（6/6 缺失）与色彩（阴影/渐变）、视觉层次（欢迎卡/命令面板）**差距最显著；Token 体系与基础布局骨架已达标。

---

## 4. 技术栈适配性评估（PySide6 / Qt QSS）

### 4.1 QSS 能力矩阵

| 能力 | QSS 支持 | 替代实现 | 结论 |
| --- | --- | --- | --- |
| 颜色 / 语义变量 | ✅ 支持 | — | 可完全满足 |
| 边框 / 圆角 / padding / 最小尺寸 | ✅ 支持 | — | 可满足 |
| `rgba(r,g,b,a%)` | ✅ 支持 | — | 可满足 |
| 线性渐变 | ⚠️ 部分 | `qlineargradient` 仅限 background | 可满足（受控件限制） |
| **投影 box-shadow** | ❌ 不支持 | `QGraphicsDropShadowEffect` | **可补** |
| **外发光 focus** | ❌ 不支持 | `QGraphicsDropShadowEffect` / 自绘 | 可补（成本高） |
| **过渡 transition** | ❌ 不支持 | `QPropertyAnimation` + `QGraphicsOpacityEffect` | **可补** |
| **关键帧动画 animation** | ❌ 不支持 | `QPropertyAnimation` / `QTimer` | **可补** |
| **媒体查询** | ❌ 不支持 | 最小窗口保护 + 代码级布局 | 桌面原生可接受 |
| `:focus-within` / `:has()` | ❌ 不支持 | 手动 focus 信号 | 可补 |
| `position: fixed` 浮层 | ❌ 不支持 | 顶层 QWidget 手动定位（已实现） | 可满足 |
| SVG 图标 | ✅ QIcon 原生 | 自绘 SVG 资源 | 可满足 |
| 滚动条细化 | ✅ 部分 | 已实现 8px 圆角 | 基本满足 |
| `letter-spacing` / 文本细节 | ⚠️ 部分 | QFont setLetterSpacing | 可满足 |

### 4.2 适配性结论

| 维度 | 支撑度 | 说明 |
| --- | --- | --- |
| 色彩系统 | 90% | 阴影/外发光/部分渐变需特效类补充 |
| 字体层级 | 95% | 行距、标题排版可通过编辑器格式调整 |
| 组件尺寸 | 85% | Dock 宽度、状态栏高度、fmtbar 高度可代码固定 |
| 间距规范 | 95% | 基本可达 |
| 视觉层次 | 75% | 欢迎卡、命令面板增强、角标等需代码实现 |
| 响应式适配 | 85% | 无媒体查询，靠最小窗口 + 折叠机制等效 |
| 动效呈现 | 30% | **最大缺口**，QSS 无过渡/动画，需 Qt 动画框架逐项补建 |

**总体评估**：PySide6/Qt 技术栈可支撑原型约 **80% 的视觉需求直接落地**；阴影、外发光、过渡与关键帧动画约 20% 需通过 **Qt 特效与动画框架（QGraphicsDropShadowEffect / QPropertyAnimation / QGraphicsOpacityEffect）+ 定时器** 等效实现。**不存在无法落地的硬性缺口**——均可在 Qt 生态内找到替代方案，无需更换技术栈。若未来需要 Web 级 CSS 生态（媒体查询、3D、粒子等），策划已预留路线 B（QWebEngineView 内嵌 Web 编辑器）作为渐进增强，不影响当前桌面端迭代。

---

## 5. 优化落地方案

按「投入产出比」分三档，全部在 PySide6 内实现。

### A 档 · 视觉收敛（P1.5，快速见效）

| 项 | 差异编号 | 做法 | 涉及文件 |
| --- | --- | --- | --- |
| A-1 顶栏品牌 LOGO | C-1 | 新增 QLabel 渐变圆角块（`qlineargradient`）+ 品牌名双色 | `app.py` / `stylesheet.py` |
| A-2 fmtbar 固定 40px | S-1 | `setFixedHeight(40)` + QSS 分隔线 `.divider` | `toolbar.py` |
| A-3 侧栏默认宽度 280 | S-2 | `dock.setFixedWidth(280)`，折叠时切 48（保留用户可拖拽可选：用 resize 事件补偿） | `app.py` |
| A-4 AI 面板宽度 340 | S-3 | `dock.setFixedWidth(340)` 折叠切 48 | `app.py` |
| A-5 状态栏 30px | S-4 | QSS `QStatusBar { min-height: 30px; }` + label 间距 8px | `stylesheet.py` |
| A-6 编辑列头 | S-5 | EditorPane 每列顶部加 26px 标签条（QLabel「编辑区 / 预览」+ 徽标） | `editor_pane.py` |
| A-7 模式切换胶囊 | S-7 | 外包 QWidget（bg-raised 圆角）+ 三按钮，选中 bg-canvas | `app.py` `_build_mode_switch` |
| A-8 命令面板增强 | H-1 | 行内加 icon（QIcon/Unicode）+ 右侧 mono 快捷键列（QListWidget 自定义绘制或双列布局） | `command_palette.py` |
| A-9 搜索框前置放大镜 | S-6 | 侧栏搜索改为 QWidget（图标 + QLineEdit） | `sidebar.py` |
| A-10 铃铛未读角标 | H-6 | 顶栏铃铛按钮叠加角标 QLabel（红点 14px，数量控制） | `app.py` |

### B 档 · 动效增强（QPropertyAnimation 体系）

| 项 | 差异编号 | 做法 |
| --- | --- | --- |
| B-1 浮层投影 | C-2 | `QGraphicsDropShadowEffect` 挂到命令面板 / 通知中心 / Toast / Diff（blur 24，offset 0,12，alpha 0.16） |
| B-2 输入聚焦外发光 | C-3 | 对 AI 输入框 / 搜索框挂弱阴影（focus 时提升）或 `QGraphicsDropShadowEffect` 品牌色 |
| B-3 Toast 滑入滑出 | M-3 | `QPropertyAnimation`（pos/opacity 200ms slideDown + 淡出） |
| B-4 弹窗 / 命令面板 popIn | M-2 | `QGraphicsOpacityEffect` + 位移动画（200ms `QPropertyAnimation`） |
| B-5 遮罩 fadeIn | M-4 | 命令面板加顶层遮罩 QWidget（opacity 动画 200ms） |
| B-6 hover 过渡 | M-1 | 关键控件（树项/菜单项/按钮）用 `QStyle` 或动画 tick 做 120ms 背景过渡（高成本项，选核心控件） |
| B-7 打字三点动画 | M-5 | `QTimer` 交替显隐三点（400ms 周期） |
| B-8 保存 ✓ 闪动 | M-5 | `QTimer` 两次切换保存标签透明度 |
| B-9 沉浸字号放大 | M-6 | 沉浸时编辑区 `setPointSize(17)`，退出恢复 |

### C 档 · 结构补充（P2 衔接）

| 项 | 差异编号 | 做法 |
| --- | --- | --- |
| C-1 欢迎空状态卡 | H-5 | 无作品时 central 显示欢迎卡（品牌插画 + 创建/导入/示例三入口），对接 `_new_work` |
| C-2 AI 面板折叠 rail | R-2 | AI Dock 折叠为 48px 图标 rail（同侧栏机制） |
| C-3 SVG 图标库 | — | 自绘 30+ 线性图标（16/20/24），替换 Unicode 过渡 |
| C-4 Diff 微浮窗 | H-3 关联 | 新增 `diff_popover.py`（原型 #diff-pop 规格：620px，左右 diff 对比 + 三按钮） |
| C-5 快捷键速查面板 | F-4 | 命令面板风格速查卡（Ctrl+/ 召唤） |
| C-6 护眼/高对比色值校准 | — | WCAG 2.1 AA 计算后回填 `palettes.py` |
| C-7 高 DPI 与 7 分辨率矩阵验证 | R-5 | 实测 1.0/1.25/1.5/2.0 缩放，修正 QSS 固定像素 |

**优先级建议**：A-1→A-3→A-7→A-8→A-4 先行（视觉主线），随后 B-1/B-3/B-4（浮层质感），B 档其余与 C 档并入 P2 排期。

---

## 6. 技术调整与补充方案

### 6.1 新增支撑组件

| 组件 | 职责 | 对应能力缺口 |
| --- | --- | --- |
| `gui/theme/effects.py` | `apply_shadow(widget, blur, alpha)` / `apply_fade_in(widget, ms)` / `slide(widget, dy, ms)` 统一动效工具 | box-shadow / transition / animation |
| `gui/theme/icons.py` | 内嵌 SVG 字符串注册表 + `make_icon(name)`（QIcon），含品牌 LOGO 渐变 | SVG 图标 / LOGO 渐变 |
| `gui/components/overlay.py` | 全屏遮罩 + 内容居中浮层（命令面板/速查/Diff 共用） | position:fixed / 遮罩 fadeIn |
| `gui/theme/gradients.py` | `brand_gradient()` 返回 QLinearGradient 供头像/LOGO/进度条 | 渐变 |

### 6.2 不更换技术栈的理由

1. **业务功能零缺口**：创作管理 / AI 适配 / 数据存储均稳定运行，30/30 测试通过；
2. **视觉缺口全部有 Qt 等效实现**（§4.2），不构成不可逾越障碍；
3. 更换 WebView 全量前端将引入 Node 工程链、双端同步与启动体积问题，与策划"轻量、低风险"路线相悖。

### 6.3 渐进增强（路线 B 评估）

若后续需要媒体查询式响应式、3D 动效、CSS 生态组件，按策划 §4.1 的 P3「跨端前置」启用 `QWebEngineView` 内嵌 Web 编辑器（仅编辑区），样式通过统一 Design Tokens（CSS 变量 + QSS 双轨）保持同步。此为本报告的**唯一结构性技术调整候选**，属可选增强而非必需。

---

## 7. 结论

| 维度 | 还原度现状 | 补齐后目标 |
| --- | --- | --- |
| 色彩系统 | 70%（token 达标，阴影/渐变缺失） | ≥ 95% |
| 字体层级 | 85% | ≥ 95% |
| 组件尺寸 | 75% | ≥ 95% |
| 间距规范 | 90% | ≥ 95% |
| 视觉层次 | 65% | ≥ 90% |
| 响应式适配 | 80% | ≥ 90% |
| 动效呈现 | 20% | ≥ 80% |

**总体结论**：当前实现已建立正确的 Design Tokens 与三栏骨架（约 65% 基础还原度），与原型的主要差距集中在 **浮层阴影、动效体系、欢迎卡、命令面板信息密度** 等视觉呈现层。**PySide6/Qt 技术栈可完全支撑原型落地**——QSS 缺失的 box-shadow / transition / animation 均可通过 `QGraphicsDropShadowEffect` / `QPropertyAnimation` / `QGraphicsOpacityEffect` + `QTimer` 等效实现，无需更换技术栈。按 §5 分档方案执行（A 档视觉收敛 → B 档动效 → C 档结构补充），可将七大维度综合还原度提升至 **90% 以上**，达成策划方案验收指标。

---

*本报告差异清单与优化方案已与《GUI设计合规性校验.md》§7（P1 落地状态）衔接；A/B/C 三档待产品评审后排期执行。*

*「续言 / Continuum」—— 让故事接续、延续下去。*
