"""continuum.gui.views - 界面视图包。

视图与业务解耦：视图通过信号向上层（主窗口）暴露事件，由主窗口统一编排服务。
"""

from continuum.gui.views.config_dialog import CozeConfigDialog
from continuum.gui.views.editor_view import EditorView
from continuum.gui.views.log_view import LogView

__all__ = ["CozeConfigDialog", "EditorView", "LogView"]
