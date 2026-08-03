"""续言 Continuum - 应用主窗口（PySide6 / Qt）。

职责：组装视图布局、编排服务（AI / 热键 / 剪贴板 / 文本录入）、管理业务流程。
核心服务层（core/）与界面完全解耦，可独立测试与演进。
"""

import threading

from PySide6.QtCore import Qt, QTimer, Signal
from PySide6.QtWidgets import (QDialog, QHBoxLayout, QMainWindow, QMessageBox,
                               QVBoxLayout, QWidget)

from continuum.config.coze_config import CozeConfig
from continuum.config.settings import APP_CONFIG, HOTKEY_CONFIG, THEME_CONFIG
from continuum.core.coze_service import CozeService
from continuum.core.hotkey_service import HotkeyService
from continuum.core.transcription_service import TranscriptionService
from continuum.gui.components.buttons import apply_button_style, styled_button
from continuum.gui.theme import build_stylesheet
from continuum.gui.views.config_dialog import CozeConfigDialog
from continuum.gui.views.editor_view import EditorView
from continuum.gui.views.log_view import LogView
from continuum.utils.clipboard_utils import ClipboardMonitor


class MainWindow(QMainWindow):
    """续言 Continuum 主窗口。"""

    # ---- 跨线程信号（工作线程 -> GUI 线程，Qt 自动排队调度）----
    log_message = Signal(str)
    clipboard_loaded = Signal(str)
    transcription_done = Signal()
    transcription_stopped = Signal()
    enhance_result = Signal(str)
    enhance_error = Signal(str)
    enhance_failed = Signal()
    hotkey_triggered = Signal()

    def __init__(self):
        super().__init__()
        self.setWindowTitle(APP_CONFIG["window_title"])
        width, height = (int(v) for v in APP_CONFIG["window_geometry"].split("x"))
        self.resize(width, height)
        self.setStyleSheet(build_stylesheet())

        # ---- 服务 ----
        self.coze_config = CozeConfig()
        self.coze_service = CozeService()
        self.transcription_service = TranscriptionService()
        self.clipboard_monitor = ClipboardMonitor(
            check_interval=APP_CONFIG["clipboard_check_interval"]
        )
        self.hotkey_service = HotkeyService()

        # ---- 状态 ----
        self.is_topmost = True
        self.fast_mode = True
        self.is_enhancing = False

        self._init_ui()
        self._connect_signals()
        self._init_services()

    # ------------------------------------------------------------------ UI
    def _init_ui(self):
        self.editor = EditorView(self)
        self.log_view = LogView(self)

        # 操作按钮区
        self.start_button = styled_button(
            "开始转写", THEME_CONFIG["secondary_color"], "#27ae60", width=110
        )
        self.start_button.clicked.connect(self.start_transcription)

        self.enhance_button = styled_button("润色转写", "#e67e22", "#d35400", width=110)
        self.enhance_button.clicked.connect(self._on_enhance_button_clicked)

        self.mode_button = styled_button(
            "当前：快速模式(200/0.5)", THEME_CONFIG["primary_color"],
            THEME_CONFIG["button_hover_color"],
        )
        self.mode_button.clicked.connect(self.toggle_typing_mode)

        self.topmost_button = styled_button(
            "取消置顶", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"]
        )
        self.topmost_button.clicked.connect(self.toggle_topmost)

        self.config_button = styled_button(
            "Coze配置", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"]
        )
        self.config_button.clicked.connect(self.open_coze_config)

        button_row = QHBoxLayout()
        for button in (self.start_button, self.enhance_button, self.mode_button,
                       self.topmost_button, self.config_button):
            button_row.addWidget(button)

        central = QWidget(self)
        layout = QVBoxLayout(central)
        layout.addWidget(self.editor, stretch=3)
        layout.addWidget(self.log_view, stretch=1)
        layout.addLayout(button_row)
        self.setCentralWidget(central)

    def _connect_signals(self):
        self.log_message.connect(self._append_log)
        self.clipboard_loaded.connect(self._on_clipboard_loaded)
        self.transcription_done.connect(self._transcription_completed)
        self.transcription_stopped.connect(self._transcription_stopped)
        self.enhance_result.connect(self._on_enhance_result)
        self.enhance_error.connect(self._on_enhance_error)
        self.enhance_failed.connect(self._on_enhance_failed)
        self.hotkey_triggered.connect(self.start_transcription)
        self.editor.log_requested.connect(self.add_log)

    def _init_services(self):
        token, user_id = self.coze_config.get("token"), self.coze_config.get("user_id")
        if token and user_id:
            self.coze_service.set_config(token, user_id)
            self.add_log("Coze API配置已加载")
        else:
            self.add_log("Coze API配置未设置，请先配置")

        self.hotkey_service.register_hotkey(
            HOTKEY_CONFIG["start_transcription"], self.hotkey_triggered.emit
        )
        self.hotkey_service.start_listening()

        self.clipboard_monitor.set_callback(self.clipboard_loaded.emit)
        self.clipboard_monitor.start()

    # --------------------------------------------------------------- 日志
    def add_log(self, message: str):
        """线程安全地追加日志（内部经信号切回 GUI 线程）。"""
        self.log_message.emit(message)

    def _append_log(self, message: str):
        self.log_view.append(message)

    # ------------------------------------------------------------ 剪贴板
    def _on_clipboard_loaded(self, text: str):
        if self.editor.auto_paste_enabled and text and text != self.editor.plain_text():
            self.editor.set_text(text)

    # ------------------------------------------------------------- 转写
    def start_transcription(self):
        if self.transcription_service.is_running():
            self.stop_transcription()
            return
        text = self.editor.plain_text()
        if not text:
            QMessageBox.warning(self, "警告", "请输入要转写的文本！")
            return
        self._set_start_button_running(True)
        self.add_log("请点击要输入的位置")
        QTimer.singleShot(2000, lambda: self._do_start_transcription(text))

    def _do_start_transcription(self, text: str):
        started = self.transcription_service.start_transcription(
            text=text,
            target_window_title=APP_CONFIG["target_window_title"],
            fast_mode=self.fast_mode,
            fast_mode_params=APP_CONFIG["fast_mode_params"],
            slow_mode_params=APP_CONFIG["slow_mode_params"],
            on_completed=self.transcription_done.emit,
            on_stopped=self.transcription_stopped.emit,
        )
        if not started:
            self._set_start_button_running(False)
            self.add_log("未找到目标窗口或文本为空，转写未开始")

    def stop_transcription(self):
        self.transcription_service.stop_transcription()
        self.add_log("正在停止转写...")

    def _set_start_button_running(self, running: bool):
        if running:
            self.start_button.setText("停止转写")
            apply_button_style(self.start_button, "#e74c3c", "#c0392b")
        else:
            self.start_button.setText("开始转写")
            apply_button_style(self.start_button, THEME_CONFIG["secondary_color"], "#27ae60")

    def _transcription_completed(self):
        text = self.editor.plain_text()
        if text:
            self.add_log(f'"{text[:5]}"……"{text.replace(" ", "")[-5:]}"  转写完成')
        self.editor.clear()
        self._set_start_button_running(False)

    def _transcription_stopped(self):
        self.add_log("转写已停止")
        self._set_start_button_running(False)

    # ------------------------------------------------------------- 润色
    def _on_enhance_button_clicked(self):
        if self.is_enhancing:
            self._cancel_enhance()
        else:
            self.start_enhance_transcription()

    def start_enhance_transcription(self):
        if not self.coze_config.is_configured():
            QMessageBox.warning(self, "配置未设置", "请先配置Coze API")
            return
        text = self.editor.plain_text()
        if not text:
            QMessageBox.warning(self, "警告", "请输入要润色的文本！")
            return
        self.is_enhancing = True
        self._set_enhance_button_running(True)
        self.add_log("正在润色文本，请稍候...")

        def worker():
            enhanced = self.coze_service.enhance_text(text, on_error=self.enhance_error.emit)
            if enhanced:
                self.enhance_result.emit(enhanced)
            else:
                self.enhance_failed.emit()

        threading.Thread(target=worker, daemon=True).start()

    def _set_enhance_button_running(self, running: bool):
        if running:
            self.enhance_button.setText("取消润色")
            apply_button_style(self.enhance_button, "#e74c3c", "#c0392b")
        else:
            self.enhance_button.setText("润色转写")
            apply_button_style(self.enhance_button, "#e67e22", "#d35400")

    def _cancel_enhance(self):
        self.is_enhancing = False
        self._set_enhance_button_running(False)
        self.coze_service.cancel_request()
        self.add_log("正在取消润色请求...")

    def _on_enhance_result(self, enhanced_text: str):
        self.is_enhancing = False
        self._set_enhance_button_running(False)
        self.add_log(f"文本润色完成，润色后长度: {len(enhanced_text)}字符")
        self._set_start_button_running(True)
        self.add_log("请点击要输入的位置")
        QTimer.singleShot(2000, lambda: self._do_start_transcription(enhanced_text))

    def _on_enhance_error(self, message: str):
        self.is_enhancing = False
        self._set_enhance_button_running(False)
        self.add_log(f"润色失败: {message}")
        QMessageBox.critical(self, "润色失败", message)

    def _on_enhance_failed(self):
        self.is_enhancing = False
        self._set_enhance_button_running(False)
        self.add_log("润色未返回结果")

    # ------------------------------------------------------------- 其他
    def toggle_typing_mode(self):
        self.fast_mode = not self.fast_mode
        if self.fast_mode:
            self.mode_button.setText("当前：快速模式(200/0.5)")
            self.add_log("已切换到快速模式：每打200字暂停0.5秒")
        else:
            self.mode_button.setText("当前：慢速模式(100/5)")
            self.add_log("已切换到慢速模式：每打100字暂停5秒")

    def toggle_topmost(self):
        self.is_topmost = not self.is_topmost
        self.setWindowFlag(Qt.WindowStaysOnTopHint, self.is_topmost)
        self.show()  # 重新应用窗口标志
        self.topmost_button.setText("取消置顶" if self.is_topmost else "置顶窗口")

    def open_coze_config(self):
        dialog = CozeConfigDialog(self.coze_config, self.coze_service, self)
        if dialog.exec() == QDialog.Accepted:
            self.coze_service.set_config(
                self.coze_config.get("token"), self.coze_config.get("user_id")
            )
            self.add_log("Coze API配置已保存")

    # ----------------------------------------------------------- 生命周期
    def cleanup(self):
        self.clipboard_monitor.stop()
        self.hotkey_service.stop_listening()
        self.coze_service.cleanup()

    def closeEvent(self, event):
        self.cleanup()
        super().closeEvent(event)
