"""续言 Continuum - Qt 主题与样式表（QSS）。

颜色体系基于 settings.THEME_CONFIG，统一界面观感。
"""

from continuum.config.settings import THEME_CONFIG

# 颜色常量（与 settings.THEME_CONFIG 保持一致）
PRIMARY_COLOR = THEME_CONFIG["primary_color"]
SECONDARY_COLOR = THEME_CONFIG["secondary_color"]
BACKGROUND_COLOR = THEME_CONFIG["background_color"]
BACKGROUND_GRADIENT = THEME_CONFIG["background_gradient"]
TEXT_COLOR = THEME_CONFIG["text_color"]
TEXT_SECONDARY_COLOR = THEME_CONFIG["text_secondary_color"]
BORDER_COLOR = THEME_CONFIG["border_color"]
BUTTON_HOVER_COLOR = THEME_CONFIG["button_hover_color"]
SUCCESS_COLOR = THEME_CONFIG["success_color"]
WARNING_COLOR = THEME_CONFIG["warning_color"]
ERROR_COLOR = THEME_CONFIG["error_color"]
FONT_FAMILY = THEME_CONFIG["font_family"]


def build_stylesheet() -> str:
    """构建全局 QSS 样式表。"""
    return f"""
    QWidget {{
        font-family: {FONT_FAMILY};
        font-size: 13px;
        color: {TEXT_COLOR};
    }}
    QMainWindow, QDialog {{
        background-color: {BACKGROUND_GRADIENT};
    }}
    QGroupBox {{
        background-color: {BACKGROUND_COLOR};
        border: 1px solid {BORDER_COLOR};
        border-radius: 8px;
        margin-top: 12px;
        padding-top: 8px;
        font-weight: bold;
    }}
    QGroupBox::title {{
        subcontrol-origin: margin;
        left: 12px;
        padding: 0 4px;
    }}
    QPlainTextEdit, QLineEdit {{
        background-color: {BACKGROUND_COLOR};
        border: 1px solid {BORDER_COLOR};
        border-radius: 6px;
        padding: 6px;
        selection-background-color: {PRIMARY_COLOR};
        selection-color: #ffffff;
    }}
    QPlainTextEdit:focus, QLineEdit:focus {{
        border-color: {PRIMARY_COLOR};
    }}
    QCheckBox {{
        spacing: 6px;
    }}
    """
