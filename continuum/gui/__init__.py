"""continuum.gui - 界面层（PySide6 / Qt）。

职责：应用主窗口、视图与 UI 组件；仅依赖 core / config / utils 层服务。
"""

from continuum.gui.app import MainWindow

__all__ = ["MainWindow"]
