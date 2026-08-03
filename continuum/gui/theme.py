"""续言 Continuum - Qt 主题与样式（亮/暗双主题，全局 QSS + Palette）。"""

from PySide6.QtGui import QColor, QPalette

from continuum.config.settings import THEME_CONFIG

# 品牌色常量（与 settings.THEME_CONFIG 一致）
PRIMARY_COLOR = THEME_CONFIG["primary_color"]
SECONDARY_COLOR = THEME_CONFIG["secondary_color"]
BACKGROUND_COLOR = THEME_CONFIG["background_color"]
TEXT_COLOR = THEME_CONFIG["text_color"]
BORDER_COLOR = THEME_CONFIG["border_color"]
BUTTON_HOVER_COLOR = THEME_CONFIG["button_hover_color"]
SUCCESS_COLOR = THEME_CONFIG["success_color"]
WARNING_COLOR = THEME_CONFIG["warning_color"]
ERROR_COLOR = THEME_CONFIG["error_color"]
FONT_FAMILY = THEME_CONFIG["font_family"]

_LIGHT = {
    "window": "#f5f7fa", "panel": "#ffffff", "input": "#ffffff",
    "text": "#24292f", "text_dim": "#666666", "border": "#d0d7de",
    "selection": PRIMARY_COLOR, "toolbar": "#ffffff",
}
_DARK = {
    "window": "#1e1e1e", "panel": "#252526", "input": "#1e1e1e",
    "text": "#d4d4d4", "text_dim": "#9d9d9d", "border": "#3c3c3c",
    "selection": "#0d7377", "toolbar": "#2d2d30",
}


def _colors(dark: bool) -> dict:
    return _DARK if dark else _LIGHT


def build_stylesheet(dark: bool = False) -> str:
    """构建全局 QSS 样式表。"""
    c = _colors(dark)
    return f"""
    QWidget {{
        color: {c['text']};
        font-family: {FONT_FAMILY};
        font-size: 13px;
    }}
    QMainWindow, QDialog {{ background: {c['window']}; }}
    QMenuBar, QToolBar, QStatusBar {{
        background: {c['toolbar']};
        border-bottom: 1px solid {c['border']};
        spacing: 4px;
    }}
    QMenu {{ background: {c['panel']}; border: 1px solid {c['border']}; }}
    QMenu::item {{ padding: 5px 22px; }}
    QMenu::item:selected {{ background: {c['selection']}; color: white; }}
    QMenu::separator {{ height: 1px; background: {c['border']}; margin: 4px 8px; }}
    QDockWidget::title {{
        background: {c['toolbar']};
        padding: 5px 10px; font-weight: bold;
        border-bottom: 1px solid {c['border']};
    }}
    QTreeWidget, QTextBrowser, QPlainTextEdit, QListWidget, QTextEdit {{
        background: {c['input']};
        border: 1px solid {c['border']};
        border-radius: 4px;
        color: {c['text']};
        selection-background-color: {c['selection']};
        selection-color: #ffffff;
    }}
    QLineEdit {{
        background: {c['input']};
        border: 1px solid {c['border']};
        border-radius: 4px;
        padding: 4px 6px;
        color: {c['text']};
    }}
    QLineEdit:focus {{ border-color: {c['selection']}; }}
    QComboBox, QDoubleSpinBox {{
        background: {c['input']};
        border: 1px solid {c['border']};
        border-radius: 4px;
        padding: 3px 6px;
        color: {c['text']};
    }}
    QPushButton {{
        background: {c['toolbar']};
        border: 1px solid {c['border']};
        border-radius: 4px;
        padding: 5px 12px;
        color: {c['text']};
    }}
    QPushButton:hover {{ background: {c['selection']}; color: white; border-color: {c['selection']}; }}
    QTabWidget::pane {{ border: 1px solid {c['border']}; }}
    QTabBar::tab {{ background: transparent; padding: 5px 14px; color: {c['text']}; }}
    QTabBar::tab:selected {{ background: {c['selection']}; color: white; border-radius: 4px; }}
    QSplitter::handle {{ background: {c['border']}; }}
    QGroupBox {{
        border: 1px solid {c['border']};
        border-radius: 6px;
        margin-top: 10px;
        font-weight: bold;
        color: {c['text']};
    }}
    QGroupBox::title {{ subcontrol-origin: margin; left: 10px; padding: 0 4px; }}
    QToolButton {{
        background: transparent;
        border: 1px solid transparent;
        border-radius: 4px;
        padding: 4px 8px;
        color: {c['text']};
    }}
    QToolButton:hover {{ background: {c['selection']}; color: white; }}
    QToolButton:checked {{ background: {c['selection']}; color: white; }}
    QCheckBox {{ spacing: 6px; color: {c['text']}; }}
    QScrollBar:vertical {{ background: transparent; width: 10px; margin: 0; }}
    QScrollBar::handle:vertical {{ background: {c['border']}; border-radius: 5px; min-height: 24px; }}
    QScrollBar:horizontal {{ background: transparent; height: 10px; margin: 0; }}
    QScrollBar::handle:horizontal {{ background: {c['border']}; border-radius: 5px; min-width: 24px; }}
    """


def build_palette(dark: bool) -> QPalette:
    """构建 Qt 调色板（配合 QSS 使用）。"""
    c = _colors(dark)
    palette = QPalette()
    palette.setColor(QPalette.Window, QColor(c["window"]))
    palette.setColor(QPalette.WindowText, QColor(c["text"]))
    palette.setColor(QPalette.Base, QColor(c["input"]))
    palette.setColor(QPalette.AlternateBase, QColor(c["panel"]))
    palette.setColor(QPalette.Text, QColor(c["text"]))
    palette.setColor(QPalette.Button, QColor(c["toolbar"]))
    palette.setColor(QPalette.ButtonText, QColor(c["text"]))
    palette.setColor(QPalette.Highlight, QColor(c["selection"]))
    palette.setColor(QPalette.HighlightedText, QColor("#ffffff"))
    palette.setColor(QPalette.ToolTipBase, QColor(c["panel"]))
    palette.setColor(QPalette.ToolTipText, QColor(c["text"]))
    palette.setColor(QPalette.PlaceholderText, QColor(c["text_dim"]))
    palette.setColor(QPalette.Link, QColor(c["selection"]))
    return palette
