"""辅助工具面板：跨窗口录入、AI 润色转写、随机生成、窗口置顶等（旧功能迁移）。"""

import threading

from PySide6.QtCore import QTimer, Signal
from PySide6.QtWidgets import (QCheckBox, QHBoxLayout, QLabel, QLineEdit,
                               QVBoxLayout, QWidget)

from continuum.config.settings import APP_CONFIG, RANDOM_GENERATION_CONFIG, THEME_CONFIG
from continuum.gui.components.buttons import apply_button_style, styled_button
from continuum.utils.clipboard_utils import ClipboardMonitor
from continuum.utils.random_utils import RandomChineseGenerator


class ToolsPanel(QWidget):
    """旧版辅助工具面板（转写 / 润色 / 随机生成 / 置顶）。"""

    log_requested = Signal(str)
    topmost_requested = Signal()
    coze_config_requested = Signal()

    # 跨线程信号（工作线程 -> GUI 线程）
    transcription_done = Signal()
    transcription_stopped = Signal()
    enhance_finished = Signal(str)
    enhance_failed = Signal()
    enhance_error = Signal(str)

    def __init__(self, editor, transcription_service, coze_service, coze_config, parent=None):
        super().__init__(parent)
        self.editor = editor
        self.transcription_service = transcription_service
        self.coze_service = coze_service
        self.coze_config = coze_config
        self.fast_mode = True
        self.is_enhancing = False
        self.random_generator = RandomChineseGenerator(
            start_unicode=RANDOM_GENERATION_CONFIG["chinese_start_unicode"],
            end_unicode=RANDOM_GENERATION_CONFIG["chinese_end_unicode"],
        )

        # 行1：目标窗口 + 自动剪贴板 + 置顶
        self.target_edit = QLineEdit(APP_CONFIG["target_window_title"], self)
        self.target_edit.setPlaceholderText("目标窗口标题")
        self.target_edit.setFixedWidth(140)
        self.auto_paste_check = QCheckBox("自动加载剪贴板", self)
        self.topmost_button = styled_button(
            "取消置顶", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"]
        )

        row1 = QHBoxLayout()
        row1.addWidget(QLabel("目标窗口：", self))
        row1.addWidget(self.target_edit)
        row1.addWidget(self.auto_paste_check)
        row1.addWidget(self.topmost_button)
        row1.addStretch()

        # 行2：开始转写 + 模式 + 润色转写
        self.start_button = styled_button(
            "开始转写", THEME_CONFIG["secondary_color"], "#27ae60", width=100
        )
        self.mode_button = styled_button(
            "快速模式(200/0.5)", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"]
        )
        self.enhance_button = styled_button("润色转写", "#e67e22", "#d35400", width=100)

        row2 = QHBoxLayout()
        row2.addWidget(self.start_button)
        row2.addWidget(self.mode_button)
        row2.addWidget(self.enhance_button)
        row2.addStretch()

        # 行3：随机生成 + Coze 配置
        self.word_num_edit = QLineEdit(str(RANDOM_GENERATION_CONFIG["default_words"]), self)
        self.word_num_edit.setFixedWidth(80)
        self.generate_button = styled_button(
            "随机生成", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"], width=100
        )
        self.coze_config_button = styled_button(
            "Coze配置", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"], width=100
        )

        row3 = QHBoxLayout()
        row3.addWidget(QLabel("随机生成字数：", self))
        row3.addWidget(self.word_num_edit)
        row3.addWidget(self.generate_button)
        row3.addWidget(self.coze_config_button)
        row3.addStretch()

        layout = QVBoxLayout(self)
        layout.setContentsMargins(8, 4, 8, 4)
        layout.addLayout(row1)
        layout.addLayout(row2)
        layout.addLayout(row3)

        # 事件
        self.start_button.clicked.connect(self.start_transcription)
        self.mode_button.clicked.connect(self.toggle_mode)
        self.enhance_button.clicked.connect(self._on_enhance_clicked)
        self.generate_button.clicked.connect(self.generate_random)
        self.topmost_button.clicked.connect(self.topmost_requested.emit)
        self.coze_config_button.clicked.connect(self.coze_config_requested.emit)

        # 剪贴板监听
        self.clipboard_monitor = ClipboardMonitor(
            check_interval=APP_CONFIG["clipboard_check_interval"]
        )
        self.clipboard_monitor.set_callback(self._on_clipboard)
        self.clipboard_monitor.start()

        # 跨线程信号接入 GUI 线程槽
        self.transcription_done.connect(self._transcription_completed)
        self.transcription_stopped.connect(self._transcription_stopped)
        self.enhance_finished.connect(self._on_enhance_finished)
        self.enhance_failed.connect(self._on_enhance_failed)
        self.enhance_error.connect(self._on_enhance_error)

    def cleanup(self):
        self.clipboard_monitor.stop()
        if self.is_enhancing:
            self.coze_service.cancel_request()
        self.transcription_service.stop_transcription()

    # ------------------------------------------------------- 剪贴板
    def _on_clipboard(self, text: str):
        if self.auto_paste_check.isChecked() and text and text != self.editor.toPlainText().strip():
            processed = "\n".join(line.strip() for line in text.split("\n") if line.strip())
            self.editor.setPlainText(processed)

    # ------------------------------------------------------- 转写
    def start_transcription(self):
        if self.transcription_service.is_running():
            self.transcription_service.stop_transcription()
            self._set_start_running(False)
            self.log_requested.emit("正在停止转写...")
            return
        text = self.editor.toPlainText().strip()
        if not text:
            self.log_requested.emit("请输入要转写的文本！")
            return
        self._set_start_running(True)
        self.log_requested.emit("请点击要输入的位置")
        QTimer.singleShot(2000, lambda: self._do_transcribe(text))

    def _do_transcribe(self, text: str):
        started = self.transcription_service.start_transcription(
            text=text,
            target_window_title=self.target_edit.text().strip() or APP_CONFIG["target_window_title"],
            fast_mode=self.fast_mode,
            fast_mode_params=APP_CONFIG["fast_mode_params"],
            slow_mode_params=APP_CONFIG["slow_mode_params"],
            on_completed=self.transcription_done.emit,
            on_stopped=self.transcription_stopped.emit,
        )
        if not started:
            self._set_start_running(False)
            self.log_requested.emit("未找到目标窗口或文本为空，转写未开始")

    def _set_start_running(self, running: bool):
        if running:
            self.start_button.setText("停止转写")
            apply_button_style(self.start_button, "#e74c3c", "#c0392b")
        else:
            self.start_button.setText("开始转写")
            apply_button_style(self.start_button, THEME_CONFIG["secondary_color"], "#27ae60")

    def _transcription_completed(self):
        text = self.editor.toPlainText().strip()
        if text:
            self.log_requested.emit(f'"{text[:5]}"……"{text.replace(" ", "")[-5:]}"  转写完成')
        self.editor.clear()
        self._set_start_running(False)

    def _transcription_stopped(self):
        self.log_requested.emit("转写已停止")
        self._set_start_running(False)

    def toggle_mode(self):
        self.fast_mode = not self.fast_mode
        if self.fast_mode:
            self.mode_button.setText("快速模式(200/0.5)")
            self.log_requested.emit("已切换到快速模式：每打200字暂停0.5秒")
        else:
            self.mode_button.setText("慢速模式(100/5)")
            self.log_requested.emit("已切换到慢速模式：每打100字暂停5秒")

    # ------------------------------------------------------- 润色转写
    def _on_enhance_clicked(self):
        if self.is_enhancing:
            self._cancel_enhance()
        else:
            self.start_enhance_transcription()

    def start_enhance_transcription(self):
        if not self.coze_config.is_configured():
            self.log_requested.emit("请先配置Coze API")
            return
        text = self.editor.toPlainText().strip()
        if not text:
            self.log_requested.emit("请输入要润色的文本！")
            return
        self.is_enhancing = True
        self._set_enhance_running(True)
        self.log_requested.emit("正在润色文本，请稍候...")

        def worker():
            enhanced = self.coze_service.enhance_text(text, on_error=self.enhance_error.emit)
            if enhanced:
                self.enhance_finished.emit(enhanced)
            else:
                self.enhance_failed.emit()

        threading.Thread(target=worker, daemon=True).start()

    def _set_enhance_running(self, running: bool):
        if running:
            self.enhance_button.setText("取消润色")
            apply_button_style(self.enhance_button, "#e74c3c", "#c0392b")
        else:
            self.enhance_button.setText("润色转写")
            apply_button_style(self.enhance_button, "#e67e22", "#d35400")

    def _cancel_enhance(self):
        self.is_enhancing = False
        self._set_enhance_running(False)
        self.coze_service.cancel_request()
        self.log_requested.emit("正在取消润色请求...")

    def _on_enhance_finished(self, text: str):
        self.is_enhancing = False
        self._set_enhance_running(False)
        self.log_requested.emit(f"文本润色完成，润色后长度: {len(text)}字符")
        self._set_start_running(True)
        self.log_requested.emit("请点击要输入的位置")
        QTimer.singleShot(2000, lambda: self._do_transcribe(text))

    def _on_enhance_failed(self):
        self.is_enhancing = False
        self._set_enhance_running(False)
        self.log_requested.emit("润色未返回结果")

    def _on_enhance_error(self, message: str):
        self.is_enhancing = False
        self._set_enhance_running(False)
        self.log_requested.emit(f"润色失败: {message}")

    # ------------------------------------------------------- 随机生成
    def generate_random(self):
        target = self.random_generator.validate_word_count(
            self.word_num_edit.text(),
            RANDOM_GENERATION_CONFIG["min_words"],
            RANDOM_GENERATION_CONFIG["max_words"],
            RANDOM_GENERATION_CONFIG["default_words"],
        )
        self.word_num_edit.setText(str(target))
        self.log_requested.emit(f"正在生成{target}字随机中文内容...")
        self.editor.setPlainText(self.random_generator.generate(target))
        self.log_requested.emit(f"{target}字随机内容生成完成")
