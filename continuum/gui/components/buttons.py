"""主题化按钮组件（替代原 Tkinter HoverButton，悬停/按下效果由 Qt 原生支持）。"""

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QPushButton


def apply_button_style(button: QPushButton, color: str, hover_color: str, fg: str = "#ffffff") -> None:
    """为按钮应用主题样式（含悬停/按下/禁用状态）。"""
    button.setStyleSheet(
        f"""
        QPushButton {{
            background-color: {color};
            color: {fg};
            border: none;
            border-radius: 6px;
            padding: 8px 16px;
            font-size: 13px;
        }}
        QPushButton:hover {{ background-color: {hover_color}; }}
        QPushButton:pressed {{ background-color: {hover_color}; }}
        QPushButton:disabled {{ background-color: #cccccc; color: #888888; }}
        """
    )


def styled_button(text: str, color: str, hover_color: str, fg: str = "#ffffff",
                  bold: bool = True, width: int = None) -> QPushButton:
    """创建主题化按钮。"""
    button = QPushButton(text)
    button.setCursor(Qt.PointingHandCursor)
    font = button.font()
    font.setBold(bold)
    button.setFont(font)
    apply_button_style(button, color, hover_color, fg)
    if width:
        button.setFixedWidth(width)
    return button
