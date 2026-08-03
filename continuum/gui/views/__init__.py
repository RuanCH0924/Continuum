"""continuum.gui.views - 界面视图包。

视图与业务解耦：视图通过信号向上层（主窗口）暴露事件，由主窗口统一编排服务。
"""

from continuum.gui.views.ai_panel import AIPanel
from continuum.gui.views.config_dialog import CozeConfigDialog
from continuum.gui.views.editor_pane import EditorPane
from continuum.gui.views.markdown_editor import MarkdownEditor
from continuum.gui.views.preview_backend import PreviewView
from continuum.gui.views.settings_dialog import AISettingsDialog
from continuum.gui.views.sidebar import WorkSidebar
from continuum.gui.views.tools_panel import ToolsPanel

__all__ = [
    "AIPanel",
    "CozeConfigDialog",
    "EditorPane",
    "MarkdownEditor",
    "PreviewView",
    "AISettingsDialog",
    "WorkSidebar",
    "ToolsPanel",
]
