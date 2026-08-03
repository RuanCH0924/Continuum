"""编辑/预览双栏面板：支持单栏编辑、双栏联动、仅预览三种模式。"""

from PySide6.QtCore import QTimer, Qt, Signal
from PySide6.QtWidgets import QSplitter, QVBoxLayout, QWidget

from continuum.gui.markdown.highlighter import MarkdownSyntaxHighlighter
from continuum.gui.views.markdown_editor import MarkdownEditor
from continuum.gui.views.preview_backend import PreviewView

MODE_EDIT = "edit"
MODE_SPLIT = "split"
MODE_PREVIEW = "preview"


class EditorPane(QWidget):
    """Markdown 编辑区 + 实时预览区（可联动滚动）。"""

    text_changed = Signal()
    mode_changed = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self._mode = MODE_SPLIT
        self._dark = False
        self._syncing = False

        self.editor = MarkdownEditor(self)
        self.highlighter = MarkdownSyntaxHighlighter(self.editor.document())
        self.preview = PreviewView(self)

        self.splitter = QSplitter(Qt.Horizontal, self)
        self.splitter.addWidget(self.editor)
        self.splitter.addWidget(self.preview)
        self.splitter.setStretchFactor(0, 1)
        self.splitter.setStretchFactor(1, 1)
        self.splitter.setSizes([430, 430])

        layout = QVBoxLayout(self)
        layout.setContentsMargins(0, 0, 0, 0)
        layout.addWidget(self.splitter)

        # 防抖渲染：停止输入 300ms 后刷新预览
        self._debounce = QTimer(self)
        self._debounce.setSingleShot(True)
        self._debounce.setInterval(300)
        self._debounce.timeout.connect(self._render_preview)

        self.editor.textChanged.connect(self._on_text_changed)
        self.editor.verticalScrollBar().valueChanged.connect(self._on_editor_scrolled)
        self.preview.scrolled.connect(self._on_preview_scrolled)

        self.set_mode(MODE_SPLIT)

    # ------------------------------------------------------- 基础接口
    def text(self) -> str:
        return self.editor.toPlainText()

    def set_text(self, text: str):
        self.editor.setPlainText(text or "")

    def set_dark(self, dark: bool):
        self._dark = dark
        self.highlighter.set_dark(dark)
        self._render_preview()

    def set_mode(self, mode: str):
        self._mode = mode
        if mode == MODE_EDIT:
            self.editor.show()
            self.preview.hide()
        elif mode == MODE_PREVIEW:
            self.editor.hide()
            self.preview.show()
            self._render_preview()
        else:
            self.editor.show()
            self.preview.show()
            self._render_preview()
        self.mode_changed.emit(mode)

    def mode(self) -> str:
        return self._mode

    # ------------------------------------------------------- 内部逻辑
    def _on_text_changed(self):
        self.text_changed.emit()
        self._debounce.start()

    def _render_preview(self):
        self.preview.set_markdown(self.editor.toPlainText(), self._dark)

    def _on_editor_scrolled(self, value: int):
        if self._syncing or not self.preview.isVisible():
            return
        bar = self.editor.verticalScrollBar()
        fraction = value / bar.maximum() if bar.maximum() else 0.0
        self._syncing = True
        self.preview.scroll_to_fraction(fraction)
        self._syncing = False

    def _on_preview_scrolled(self, fraction: float):
        if self._syncing or not self.editor.isVisible():
            return
        bar = self.editor.verticalScrollBar()
        self._syncing = True
        bar.setValue(int(fraction * bar.maximum()))
        self._syncing = False
