"""Markdown 快捷格式工具栏（常用格式按钮组）。"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QHBoxLayout, QToolButton, QWidget

from continuum.gui.theme import BUTTON_HOVER_COLOR, PRIMARY_COLOR

# (动作名, 图标文本, 提示)
_ACTIONS = [
    ("h1", "H1", "一级标题"),
    ("h2", "H2", "二级标题"),
    ("h3", "H3", "三级标题"),
    ("bold", "B", "加粗"),
    ("italic", "I", "斜体"),
    ("strike", "S", "删除线"),
    ("code", "</>", "行内代码"),
    ("code_block", "{}", "代码块"),
    ("quote", "❝", "引用"),
    ("ul", "•", "无序列表"),
    ("ol", "1.", "有序列表"),
    ("task", "☑", "任务列表"),
    ("table", "▦", "插入表格"),
    ("link", "🔗", "插入链接"),
    ("image", "🖼", "插入图片"),
    ("hr", "—", "分隔线"),
]


class MarkdownToolbar(QWidget):
    """格式工具栏：点击后由关联的编辑器执行格式化动作。"""

    action_triggered = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        layout = QHBoxLayout(self)
        layout.setContentsMargins(4, 2, 4, 2)
        layout.setSpacing(4)
        for name, label, tip in _ACTIONS:
            button = QToolButton(self)
            button.setText(label)
            button.setToolTip(tip)
            button.setCursor(Qt.PointingHandCursor)
            button.setStyleSheet(
                f"""
                QToolButton {{
                    background: transparent; color: #555555;
                    border: 1px solid transparent; border-radius: 4px;
                    padding: 4px 8px; font-size: 13px;
                }}
                QToolButton:hover {{
                    background: {BUTTON_HOVER_COLOR}; color: #ffffff;
                }}
                QToolButton:pressed {{ background: {PRIMARY_COLOR}; color: #ffffff; }}
                """
            )
            button.clicked.connect(lambda _=False, n=name: self.action_triggered.emit(n))
            layout.addWidget(button)
        layout.addStretch()
