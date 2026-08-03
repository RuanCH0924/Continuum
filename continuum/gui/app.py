"""续言 Continuum - 应用主窗口（PySide6 / Qt）。

整合：双栏 Markdown 编辑器（编辑/双栏/预览三模式）、作品/章节管理、
大纲导航、AI 对话助手（统一适配层）、旧版辅助工具（转写/润色/随机生成）。
"""

import datetime
import re
import threading

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtGui import QAction, QActionGroup, QKeySequence
from PySide6.QtWidgets import (QDockWidget, QInputDialog, QLabel, QMainWindow,
                               QMessageBox, QToolBar, QVBoxLayout, QWidget)

from continuum.ai.base import ChatMessage
from continuum.ai.registry import ProviderRegistry
from continuum.config.coze_config import CozeConfig
from continuum.config.settings import APP_CONFIG, EDITOR_CONFIG, HOTKEY_CONFIG
from continuum.core.coze_service import CozeService
from continuum.core.hotkey_service import HotkeyService
from continuum.core.transcription_service import TranscriptionService
from continuum.gui.markdown.toolbar import MarkdownToolbar
from continuum.gui.theme import build_palette, build_stylesheet
from continuum.gui.views.ai_panel import AIPanel
from continuum.gui.views.config_dialog import CozeConfigDialog
from continuum.gui.views.editor_pane import EditorPane, MODE_EDIT, MODE_PREVIEW, MODE_SPLIT
from continuum.gui.views.settings_dialog import AISettingsDialog
from continuum.gui.views.sidebar import WorkSidebar
from continuum.gui.views.tools_panel import ToolsPanel
from continuum.services.app_state import AppState
from continuum.services.work_store import WorkStore

_SYSTEM_PROMPT = (
    "你是「续言 / Continuum」的写作助手，面向中文网络文学作者。"
    "你熟悉网文创作规律（黄金三章、爽点节奏、伏笔回收、人设一致性等），"
    "回答要专业、具体、可操作。"
)
_POLISH_PROMPT = (
    "你是专业的中文网文编辑。请润色用户提供的文本，使其描写更生动、"
    "对白更自然、节奏更紧凑，保持原意与风格不变，直接输出润色后的完整文本。"
)
_CONTINUE_PROMPT = (
    "你是中文网文续写助手。请根据用户提供的情节自然续写，"
    "保持人物口吻与文风一致，直接输出续写内容，不要任何解释。"
)


class MainWindow(QMainWindow):
    """续言 Continuum 主窗口。"""

    # ---- 跨线程信号（工作线程 -> GUI 线程）----
    hotkey_triggered = Signal()
    ai_delta = Signal(str)
    ai_completed = Signal(str)
    ai_error = Signal(str)

    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_CONFIG["window_title"])
        self.resize(1280, 820)

        # ---- 服务与数据 ----
        self.work_store = WorkStore()
        self.app_state = AppState()
        self.provider_registry = ProviderRegistry()
        self.coze_config = CozeConfig()
        self.coze_service = CozeService()
        self.transcription_service = TranscriptionService()
        self.hotkey_service = HotkeyService()

        # ---- 文档状态 ----
        self.current_work_id = ""
        self.current_chapter = None
        self._chat_history = []
        self._ai_busy = False
        self._pending_action = None  # ("polish"|"continue", QTextCursor)

        self._init_ui()
        self._connect_signals()
        self._init_services()
        self._restore_state()

    # ================================================================ UI
    def _init_ui(self):
        # 主工具栏
        toolbar = QToolBar("主工具栏", self)
        toolbar.setMovable(False)
        self.addToolBar(toolbar)

        self._mode_actions = {}
        self.mode_group = QActionGroup(self)
        for mode, label in ((MODE_EDIT, "仅编辑"), (MODE_SPLIT, "双栏"),
                            (MODE_PREVIEW, "仅预览")):
            action = QAction(label, self, checkable=True)
            action.triggered.connect(lambda checked, m=mode: checked and self._set_mode(m))
            self.mode_group.addAction(action)
            self._mode_actions[mode] = action
            toolbar.addAction(action)
        self.mode_group.setExclusive(True)

        toolbar.addSeparator()
        self.theme_action = QAction("暗色主题", self, checkable=True)
        self.theme_action.triggered.connect(lambda checked: self._apply_theme(checked))
        toolbar.addAction(self.theme_action)

        # 菜单栏
        menu_bar = self.menuBar()
        file_menu = menu_bar.addMenu("文件(&F)")
        file_menu.addAction("新建作品...", self._new_work)
        file_menu.addAction("新建章节...", self._new_chapter)
        file_menu.addSeparator()
        save_action = file_menu.addAction("保存当前章节", self._save_current_chapter)
        save_action.setShortcut(QKeySequence("Ctrl+S"))
        file_menu.addSeparator()
        file_menu.addAction("退出", self.close)

        view_menu = menu_bar.addMenu("视图(&V)")
        for mode, label in ((MODE_EDIT, "仅编辑"), (MODE_SPLIT, "双栏同步"),
                            (MODE_PREVIEW, "仅预览")):
            view_menu.addAction(self._mode_actions[mode])
        view_menu.addSeparator()
        view_menu.addAction("切换主题", self.theme_action.trigger)

        setting_menu = menu_bar.addMenu("设置(&S)")
        setting_menu.addAction("AI 服务设置...", self.open_ai_settings)
        setting_menu.addAction("Coze 配置（旧）...", self.open_coze_config)

        # 中央：格式工具栏 + 编辑/预览面板
        central = QWidget(self)
        layout = QVBoxLayout(central)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.setSpacing(0)
        self.markdown_toolbar = MarkdownToolbar(central)
        self.editor_pane = EditorPane(central)
        layout.addWidget(self.markdown_toolbar)
        layout.addWidget(self.editor_pane, stretch=1)
        self.setCentralWidget(central)

        # 左侧：作品/大纲
        self.sidebar = WorkSidebar(self)
        sidebar_dock = QDockWidget("作品与大纲", self)
        sidebar_dock.setWidget(self.sidebar)
        sidebar_dock.setMinimumWidth(220)
        self.addDockWidget(Qt.LeftDockWidgetArea, sidebar_dock)

        # 右侧：AI 助手
        self.ai_panel = AIPanel(self)
        ai_dock = QDockWidget("AI 助手", self)
        ai_dock.setWidget(self.ai_panel)
        ai_dock.setMinimumWidth(300)
        self.addDockWidget(Qt.RightDockWidgetArea, ai_dock)

        # 底部：辅助工具（旧功能）
        self.tools_panel = ToolsPanel(
            editor=self.editor_pane.editor,
            transcription_service=self.transcription_service,
            coze_service=self.coze_service,
            coze_config=self.coze_config,
        )
        tools_dock = QDockWidget("辅助工具", self)
        tools_dock.setWidget(self.tools_panel)
        tools_dock.setMaximumHeight(140)
        self.addDockWidget(Qt.BottomDockWidgetArea, tools_dock)

        # 状态栏
        self.word_count_label = QLabel("字数：0 | 字符：0", self)
        self.model_label = QLabel(f"AI 模型：{self.provider_registry.config.model}", self)
        self.autosave_label = QLabel("", self)
        self.statusBar().addWidget(self.word_count_label)
        self.statusBar().addPermanentWidget(self.model_label)
        self.statusBar().addPermanentWidget(self.autosave_label)

        # 草稿自动保存
        self.autosave_timer = QTimer(self)
        self.autosave_timer.setInterval(EDITOR_CONFIG["autosave_interval"] * 1000)
        self.autosave_timer.timeout.connect(self._autosave)
        self.autosave_timer.start()

    def _connect_signals(self):
        self.editor_pane.text_changed.connect(self._on_editor_changed)
        self.editor_pane.mode_changed.connect(
            lambda m: self.app_state.set("editor_mode", m)
        )
        self.markdown_toolbar.action_triggered.connect(
            self.editor_pane.editor.apply_format_action
        )

        # 侧栏
        self.sidebar.new_work_requested.connect(self._new_work)
        self.sidebar.new_chapter_requested.connect(self._new_chapter)
        self.sidebar.delete_work_requested.connect(self._delete_work)
        self.sidebar.delete_chapter_requested.connect(self._delete_chapter)
        self.sidebar.work_activated.connect(self._on_work_activated)
        self.sidebar.chapter_activated.connect(self._on_chapter_activated)
        self.sidebar.outline_activated.connect(self._jump_to_block)

        # AI 面板
        self.ai_panel.send_requested.connect(self._ai_send)
        self.ai_panel.polish_requested.connect(self._ai_polish)
        self.ai_panel.continue_requested.connect(self._ai_continue)
        self.ai_panel.clear_requested.connect(self._ai_clear)
        self.ai_delta.connect(self.ai_panel.append_delta)
        self.ai_completed.connect(self._on_ai_completed)
        self.ai_error.connect(self._on_ai_error)

        # 工具面板
        self.tools_panel.log_requested.connect(self._status_log)
        self.tools_panel.topmost_requested.connect(self.toggle_topmost)
        self.tools_panel.coze_config_requested.connect(self.open_coze_config)
        self.hotkey_triggered.connect(self.tools_panel.start_transcription)

    def _init_services(self):
        self.hotkey_service.register_hotkey(
            HOTKEY_CONFIG["start_transcription"], self.hotkey_triggered.emit
        )
        self.hotkey_service.start_listening()

    # ============================================================ 状态
    def _restore_state(self):
        theme = self.app_state.get("theme", EDITOR_CONFIG["default_theme"])
        self._apply_theme(theme == "dark")
        mode = self.app_state.get("editor_mode", EDITOR_CONFIG["default_mode"])
        self._set_mode(mode)

        works = self.work_store.list_works()
        if not works:
            self.sidebar.load_works([])
            return
        last_work = self.app_state.get("last_work", "") or works[0]["id"]
        self._reload_sidebar(selected_work=last_work, selected_index=0)
        last_index = self.app_state.get("last_chapter_index", 0)
        self._load_chapter(last_work, last_index)
        self.sidebar.load_chapters(self.work_store.list_chapters(last_work), last_index)

    def _reload_sidebar(self, selected_work: str = "", selected_index: int = 0):
        works = self.work_store.list_works()
        sel = selected_work or self.current_work_id or (works[0]["id"] if works else "")
        self.sidebar.load_works(works, sel)
        if sel:
            self.sidebar.current_work_id = sel
            self.sidebar.load_chapters(self.work_store.list_chapters(sel), selected_index)

    def _apply_theme(self, dark: bool):
        from PySide6.QtWidgets import QApplication
        app = QApplication.instance()
        if app is None:
            return
        app.setPalette(build_palette(dark))
        app.setStyleSheet(build_stylesheet(dark))
        self.editor_pane.set_dark(dark)
        self.theme_action.setChecked(dark)
        self.app_state.set("theme", "dark" if dark else "light")

    def _set_mode(self, mode: str):
        self.editor_pane.set_mode(mode)
        action = self._mode_actions.get(mode)
        if action:
            action.setChecked(True)

    def toggle_topmost(self):
        self.is_topmost = not getattr(self, "is_topmost", True)
        self.setWindowFlag(Qt.WindowStaysOnTopHint, self.is_topmost)
        self.show()
        self.tools_panel.topmost_button.setText(
            "取消置顶" if self.is_topmost else "置顶窗口"
        )

    # ============================================================ 编辑器
    def _on_editor_changed(self):
        text = self.editor_pane.text()
        chars = len(text.replace(" ", "").replace("\n", ""))
        total = len(text)
        self.word_count_label.setText(f"字数：{chars} | 字符：{total}")
        self.sidebar.set_outline(self._extract_outline())

    def _extract_outline(self):
        items = []
        document = self.editor_pane.editor.document()
        for block_number in range(document.blockCount()):
            match = re.match(r"^(#{1,6})\s+(.*)", document.findBlockByNumber(block_number).text())
            if match:
                items.append((len(match.group(1)), match.group(2).strip(), block_number))
        return items

    def _jump_to_block(self, block_number: int):
        editor = self.editor_pane.editor
        block = editor.document().findBlockByNumber(block_number)
        cursor = editor.textCursor()
        cursor.setPosition(block.position())
        editor.setTextCursor(cursor)
        editor.centerCursor()
        editor.setFocus()

    # ========================================================== 作品/章节
    def _new_work(self):
        title, ok = QInputDialog.getText(self, "新建作品", "作品名称：")
        if ok and title.strip():
            meta = self.work_store.create_work(title.strip())
            self._reload_sidebar(selected_work=meta["id"], selected_index=0)
            self._status_log(f"已创建作品：{meta['title']}")

    def _on_work_activated(self, work_id: str):
        self._load_chapter(work_id, 0)
        self.sidebar.load_chapters(self.work_store.list_chapters(work_id), 0)

    def _new_chapter(self):
        work_id = self.sidebar.current_work_id
        if not work_id:
            QMessageBox.information(self, "提示", "请先选择或新建一部作品")
            return
        title, ok = QInputDialog.getText(self, "新建章节", "章节标题：")
        if ok and title.strip():
            self._save_current_chapter()
            chapter = self.work_store.create_chapter(work_id, title.strip())
            self._load_chapter(chapter.work_id, chapter.index)
            self._reload_sidebar(selected_work=chapter.work_id, selected_index=chapter.index)
            self._status_log(f"已创建章节：{chapter.title}")

    def _on_chapter_activated(self, index: int):
        self._load_chapter(self.sidebar.current_work_id, index)

    def _load_chapter(self, work_id: str, index: int):
        self._save_current_chapter()
        self.current_work_id = work_id
        chapter = self.work_store.get_chapter(work_id, index)
        if chapter is None:
            self.current_chapter = None
            self.editor_pane.set_text("")
            self.app_state.set("last_work", work_id)
            self.app_state.set("last_chapter_index", index)
            self._update_title()
            self._on_editor_changed()
            return
        self.current_chapter = chapter
        chapter.content = self.work_store.read_chapter(chapter)
        self.editor_pane.set_text(chapter.content)
        self.app_state.set("last_work", work_id)
        self.app_state.set("last_chapter_index", index)
        self._update_title()
        self._on_editor_changed()

    def _save_current_chapter(self):
        if self.current_chapter is None:
            return
        content = self.editor_pane.text()
        self.work_store.save_chapter(
            self.current_work_id, self.current_chapter.index,
            self.current_chapter.title, content,
        )
        self.autosave_label.setText(f"已保存 {datetime.datetime.now():%H:%M:%S}")

    def _autosave(self):
        if self.current_chapter is not None:
            self._save_current_chapter()

    def _delete_work(self, work_id: str):
        answer = QMessageBox.question(
            self, "删除作品", "确定删除该作品及其全部章节？此操作不可恢复。"
        )
        if answer == QMessageBox.Yes:
            self.work_store.delete_work(work_id)
            if self.current_work_id == work_id:
                self.current_work_id = ""
                self.current_chapter = None
                self.editor_pane.set_text("")
                self._update_title()
            self._reload_sidebar()
            self._status_log("作品已删除")

    def _delete_chapter(self, index: int):
        work_id = self.sidebar.current_work_id
        if not work_id:
            return
        answer = QMessageBox.question(self, "删除章节", "确定删除该章节？")
        if answer == QMessageBox.Yes:
            self.work_store.delete_chapter(work_id, index)
            if self.current_chapter and self.current_chapter.index == index:
                self.current_chapter = None
                self.editor_pane.set_text("")
                self._update_title()
            self._reload_sidebar(selected_work=work_id, selected_index=0)
            self._status_log("章节已删除")

    def _update_title(self):
        title = APP_CONFIG["window_title"]
        if self.current_chapter and self.current_work_id:
            work = self.work_store.get_work(self.current_work_id)
            work_title = work["title"] if work else ""
            title = f"{self.current_chapter.title} - {work_title} - 续言 Continuum"
        self.setWindowTitle(title)

    # ================================================================ AI
    def _ai_check(self) -> bool:
        if self._ai_busy:
            self._status_log("AI 正在处理中，请稍候")
            return False
        if not self.provider_registry.is_configured():
            QMessageBox.information(self, "未配置", "请先在「设置 → AI 服务」中配置 API Key")
            return False
        return True

    def _run_ai(self, messages):
        self._ai_busy = True
        provider = self.provider_registry.create_provider()

        def worker():
            full = ""
            try:
                def on_delta(delta: str):
                    nonlocal full
                    full += delta
                    self.ai_delta.emit(delta)
                provider.chat_stream(messages, on_delta=on_delta)
                self.ai_completed.emit(full)
            except RuntimeError as exc:
                self.ai_error.emit(str(exc))

        threading.Thread(target=worker, daemon=True).start()

    def _ai_send(self, text: str):
        if not self._ai_check():
            return
        self._chat_history.append(ChatMessage("user", text))
        self.ai_panel.append_user(text)
        self.ai_panel.begin_assistant()
        messages = [ChatMessage("system", _SYSTEM_PROMPT), *self._chat_history]
        self._run_ai(messages)

    def _ai_polish(self):
        if not self._ai_check():
            return
        editor = self.editor_pane.editor
        cursor = editor.textCursor()
        if not cursor.hasSelection():
            self._status_log("请先在编辑区选中要润色的文本")
            return
        selected = cursor.selectedText().replace("\u2029", "\n")
        self._pending_action = ("polish", cursor)
        self.ai_panel.append_user("（润色选中文本）")
        self.ai_panel.begin_assistant()
        self._run_ai([
            ChatMessage("system", _POLISH_PROMPT),
            ChatMessage("user", selected),
        ])

    def _ai_continue(self):
        if not self._ai_check():
            return
        editor = self.editor_pane.editor
        cursor = editor.textCursor()
        tail = self.editor_pane.text()[-2000:]
        if not tail:
            self._status_log("编辑区还没有内容可供续写")
            return
        self._pending_action = ("continue", cursor)
        self.ai_panel.append_user("（续写请求）")
        self.ai_panel.begin_assistant()
        self._run_ai([
            ChatMessage("system", _CONTINUE_PROMPT),
            ChatMessage("user", f"请根据以下情节续写：\n\n{tail}"),
        ])

    def _ai_clear(self):
        self._chat_history = []
        self.ai_panel.clear_chat()
        self._status_log("对话已清空")

    def _on_ai_completed(self, full: str):
        self._ai_busy = False
        if self._pending_action is not None:
            action, cursor = self._pending_action
            self._pending_action = None
            editor = self.editor_pane.editor
            editor.setTextCursor(cursor)
            insert_cursor = editor.textCursor()
            insert_cursor.insertText(("\n" if action == "continue" else "") + full)
        else:
            self._chat_history.append(ChatMessage("assistant", full))
        self.ai_panel.end_assistant()

    def _on_ai_error(self, message: str):
        self._ai_busy = False
        self._pending_action = None
        self.ai_panel.append_error(message)

    # ============================================================== 设置
    def open_ai_settings(self):
        dialog = AISettingsDialog(self.provider_registry, self)
        if dialog.exec():
            self.model_label.setText(f"AI 模型：{self.provider_registry.config.model}")

    def open_coze_config(self):
        dialog = CozeConfigDialog(self.coze_config, self.coze_service, self)
        if dialog.exec():
            self.coze_service.set_config(
                self.coze_config.get("token"), self.coze_config.get("user_id")
            )
            self._status_log("Coze API配置已保存")

    # ============================================================ 其他
    def _status_log(self, message: str):
        self.statusBar().showMessage(message, 6000)

    def cleanup(self):
        self.autosave_timer.stop()
        self._save_current_chapter()
        self.tools_panel.cleanup()
        self.hotkey_service.stop_listening()
        self.coze_service.cleanup()

    def closeEvent(self, event):
        self.cleanup()
        super().closeEvent(event)
