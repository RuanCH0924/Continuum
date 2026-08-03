"""操作日志视图。"""

from PySide6.QtWidgets import QGroupBox, QPlainTextEdit, QVBoxLayout


class LogView(QGroupBox):
    """操作日志面板（只读文本，自动滚动到底部）。"""

    def __init__(self, parent=None):
        super().__init__("操作日志", parent)
        self._text = QPlainTextEdit(self)
        self._text.setReadOnly(True)
        layout = QVBoxLayout(self)
        layout.addWidget(self._text)

    def append(self, message: str) -> None:
        """追加一条日志并滚动到底部。"""
        self._text.appendPlainText(message)
        scrollbar = self._text.verticalScrollBar()
        scrollbar.setValue(scrollbar.maximum())
