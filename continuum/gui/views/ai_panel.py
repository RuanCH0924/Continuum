"""AI 对话助手面板（基于统一 AI 适配层，流式展示）。"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtGui import QTextCursor
from PySide6.QtWidgets import (QHBoxLayout, QLabel, QPlainTextEdit, QTextBrowser,
                               QVBoxLayout, QWidget)

from continuum.gui.components.buttons import styled_button
from continuum.gui.theme import BUTTON_HOVER_COLOR, PRIMARY_COLOR


class AIPanel(QWidget):
    """AI 写作助手对话面板。"""

    send_requested = Signal(str)
    polish_requested = Signal()
    continue_requested = Signal()
    clear_requested = Signal()

    def __init__(self, parent=None):
        super().__init__(parent)
        self._streaming = False

        header = QLabel("AI 写作助手", self)
        header.setStyleSheet("font-weight: bold; padding: 2px 0;")

        self.chat_view = QTextBrowser(self)
        self.chat_view.setPlaceholderText("AI 对话将显示在这里")

        self.input_edit = QPlainTextEdit(self)
        self.input_edit.setPlaceholderText("向 AI 提问…（Enter 发送，Shift+Enter 换行）")
        self.input_edit.setMaximumHeight(80)

        self.send_button = styled_button("发送", PRIMARY_COLOR, BUTTON_HOVER_COLOR, width=64)
        self.polish_button = styled_button("润色选中", "#6f42c1", "#5a32a3")
        self.continue_button = styled_button("续写", "#e67e22", "#d35400")
        self.clear_button = styled_button("清空", "#6c757d", "#495057", width=64)

        bottom_row = QHBoxLayout()
        bottom_row.addWidget(self.polish_button)
        bottom_row.addWidget(self.continue_button)
        bottom_row.addWidget(self.clear_button)
        bottom_row.addWidget(self.send_button)

        layout = QVBoxLayout(self)
        layout.addWidget(header)
        layout.addWidget(self.chat_view, stretch=1)
        layout.addWidget(self.input_edit)
        layout.addLayout(bottom_row)

        self.send_button.clicked.connect(self._on_send)
        self.polish_button.clicked.connect(self.polish_requested.emit)
        self.continue_button.clicked.connect(self.continue_requested.emit)
        self.clear_button.clicked.connect(self.clear_requested.emit)

    def _on_send(self):
        text = self.input_edit.toPlainText().strip()
        if text:
            self.input_edit.clear()
            self.send_requested.emit(text)

    # ------------------------------------------------------- 流式展示
    def append_user(self, text: str):
        self._append_block("用户", text)

    def begin_assistant(self):
        self._streaming = True
        self._append_block("AI", "")

    def append_delta(self, delta: str):
        cursor = self.chat_view.textCursor()
        cursor.movePosition(QTextCursor.End)
        self.chat_view.setTextCursor(cursor)
        self.chat_view.insertPlainText(delta)
        bar = self.chat_view.verticalScrollBar()
        bar.setValue(bar.maximum())

    def end_assistant(self):
        self._streaming = False

    def append_error(self, message: str):
        self._append_block("错误", message)
        self._streaming = False

    def clear_chat(self):
        self.chat_view.clear()
        self._streaming = False

    def _append_block(self, tag: str, text: str):
        self.chat_view.append(f"<b>[{tag}]</b> {text}")
        bar = self.chat_view.verticalScrollBar()
        bar.setValue(bar.maximum())
