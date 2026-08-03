"""Markdown 实时预览视图。

优先使用 QtWebEngine（Obsidian 级渲染质量）；在无显示环境或 WebEngine
不可用时自动回退到 QTextBrowser。
"""

import os

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import QTextBrowser, QVBoxLayout, QWidget

from continuum.gui.markdown.renderer import render_markdown


def webengine_available() -> bool:
    """WebEngine 是否可用。

    - 环境变量 CONTINUUM_DISABLE_WEBENGINE=1 强制使用文本浏览器兜底；
    - offscreen 平台（无显示环境）下不可用。
    """
    if os.environ.get("QT_QPA_PLATFORM") == "offscreen":
        return False
    if os.environ.get("CONTINUUM_DISABLE_WEBENGINE") == "1":
        return False
    try:
        from PySide6.QtWebEngineWidgets import QWebEngineView  # noqa: F401
        return True
    except ImportError:
        return False


class PreviewView(QWidget):
    """Markdown 实时渲染预览（亮/暗主题，滚动比例同步）。"""

    scrolled = Signal(float)  # 0.0 ~ 1.0，预览区滚动比例

    def __init__(self, parent=None):
        super().__init__(parent)
        self._doc_height = 1.0
        self._pending_fraction = None
        self._web = None
        self._browser = None

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)

        if webengine_available():
            from PySide6.QtWebEngineWidgets import QWebEngineView
            self._web = QWebEngineView(self)
            layout.addWidget(self._web)
            page = self._web.page()
            page.loadFinished.connect(self._on_load_finished)
            try:
                page.scrollPositionChanged.connect(self._on_web_scrolled)
            except AttributeError:
                pass
        else:
            self._browser = QTextBrowser(self)
            self._browser.setOpenExternalLinks(True)
            layout.addWidget(self._browser)
            self._browser.verticalScrollBar().valueChanged.connect(self._on_browser_scrolled)

    @property
    def has_webengine(self) -> bool:
        return self._web is not None

    def set_markdown(self, text: str, dark: bool = False):
        html = render_markdown(text, dark)
        if self._web is not None:
            self._web.setHtml(html)
        else:
            self._browser.setHtml(html)

    # ------------------------------------------------------- 滚动联动
    def scroll_to_fraction(self, fraction: float):
        fraction = max(0.0, min(1.0, fraction))
        if self._web is not None:
            script = (
                f"window.scrollTo(0, {fraction} * "
                "(document.body.scrollHeight - window.innerHeight));"
            )
            self._web.page().runJavaScript(script)
        else:
            bar = self._browser.verticalScrollBar()
            bar.setValue(int(fraction * bar.maximum()))

    def _on_load_finished(self, ok: bool):
        self._web.page().runJavaScript(
            "document.body.scrollHeight", self._on_doc_height
        )

    def _on_doc_height(self, height):
        self._doc_height = max(float(height or 1.0), 1.0)

    def _on_web_scrolled(self, pos):
        self.scrolled.emit(max(0.0, min(1.0, pos.y() / self._doc_height)))

    def _on_browser_scrolled(self, value: int):
        bar = self._browser.verticalScrollBar()
        self.scrolled.emit(value / bar.maximum() if bar.maximum() else 0.0)
