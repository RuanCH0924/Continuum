"""Markdown 源码编辑器：自动补全 + 格式化动作。"""

from PySide6.QtCore import Qt
from PySide6.QtGui import QTextCursor
from PySide6.QtWidgets import QPlainTextEdit

from continuum.gui.markdown.completion import close_pair, continuation_prefix

_TABLE_TEMPLATE = "| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n"


class MarkdownEditor(QPlainTextEdit):
    """支持成对符号自动闭合、列表续行与快捷格式化的 Markdown 编辑器。"""

    def __init__(self, parent=None):
        super().__init__(parent)
        self.setLineWrapMode(QPlainTextEdit.WidgetWidth)
        self.setTabChangesFocus(False)

    # ------------------------------------------------------ 键盘行为
    def keyPressEvent(self, event):
        key = event.key()
        if key == Qt.Key_Tab:
            self._indent()
            return
        if key in (Qt.Key_Return, Qt.Key_Enter):
            if self._handle_enter():
                return
        if len(event.text()) == 1 and event.text() in close_pair.AUTO_PAIRS:
            if self._auto_pair(event.text()):
                return
        super().keyPressEvent(event)

    def _auto_pair(self, open_char: str) -> bool:
        """成对符号自动补全 / 光标跨过右符号。"""
        cursor = self.textCursor()
        close_char = close_pair(open_char)
        if cursor.hasSelection():
            sel = cursor.selectedText()
            cursor.insertText(f"{open_char}{sel}{close_char}")
            self.setTextCursor(cursor)
            return True
        if close_char and self.document().characterAt(cursor.position()) == close_char:
            cursor.movePosition(QTextCursor.Right)
            self.setTextCursor(cursor)
            return True
        cursor.insertText(open_char + close_char)
        cursor.movePosition(QTextCursor.Left)
        self.setTextCursor(cursor)
        return True

    def _handle_enter(self) -> bool:
        """列表项 / 引用回车后自动续行。"""
        cursor = self.textCursor()
        prefix = continuation_prefix(cursor.block().text())
        if prefix is not None:
            cursor.insertText("\n" + prefix)
            return True
        return False

    def _indent(self):
        cursor = self.textCursor()
        if cursor.hasSelection():
            self.insertPlainText("\t")
        else:
            cursor.insertText("    ")
            self.setTextCursor(cursor)

    # ------------------------------------------------------ 格式化动作
    def apply_format_action(self, action: str):
        """执行工具栏格式化动作。"""
        handlers = {
            "bold": lambda: self._wrap("**"),
            "italic": lambda: self._wrap("*"),
            "strike": lambda: self._wrap("~~"),
            "code": lambda: self._wrap("`"),
            "code_block": lambda: self._wrap_block("```"),
            "h1": lambda: self._prefix_lines("# "),
            "h2": lambda: self._prefix_lines("## "),
            "h3": lambda: self._prefix_lines("### "),
            "quote": lambda: self._prefix_lines("> "),
            "ul": lambda: self._prefix_lines("- "),
            "ol": lambda: self._prefix_lines("1. "),
            "task": lambda: self._prefix_lines("- [ ] "),
            "link": lambda: self._insert_link(False),
            "image": lambda: self._insert_link(True),
            "hr": lambda: self.insertPlainText("\n---\n"),
            "table": lambda: self.insertPlainText(_TABLE_TEMPLATE),
        }
        handler = handlers.get(action)
        if handler:
            handler()

    def _wrap(self, marker: str):
        cursor = self.textCursor()
        if cursor.hasSelection():
            sel = cursor.selectedText()
            cursor.insertText(f"{marker}{sel}{marker}")
        else:
            cursor.insertText(marker + marker)
            cursor.movePosition(QTextCursor.Left, QTextCursor.MoveAnchor, len(marker))
        self.setTextCursor(cursor)

    def _wrap_block(self, marker: str):
        cursor = self.textCursor()
        if cursor.hasSelection():
            sel = cursor.selectedText()
            cursor.insertText(f"{marker}\n{sel}\n{marker}")
        else:
            cursor.insertText(f"{marker}\n\n{marker}")
            cursor.movePosition(QTextCursor.Up)
            cursor.movePosition(QTextCursor.EndOfLine)
        self.setTextCursor(cursor)

    def _prefix_lines(self, prefix: str):
        cursor = self.textCursor()
        start, end = cursor.selectionStart(), cursor.selectionEnd()
        text = self.toPlainText()
        line_start = text.rfind("\n", 0, start) + 1
        line_end = text.find("\n", end)
        if line_end == -1:
            line_end = len(text)
        selected = text[line_start:line_end]
        prefixed = "\n".join(prefix + line if line else prefix for line in selected.split("\n"))
        new_text = text[:line_start] + prefixed + text[line_end:]
        self.setPlainText(new_text)
        cursor.setPosition(line_start)
        cursor.setPosition(line_start + len(prefixed), QTextCursor.KeepAnchor)
        self.setTextCursor(cursor)

    def _insert_link(self, is_image: bool):
        cursor = self.textCursor()
        sel = cursor.selectedText()
        if is_image:
            cursor.insertText(f"![{sel or '图片描述'}](https://)")
        else:
            cursor.insertText(f"[{sel or '链接文字'}](https://)")
        self.setTextCursor(cursor)
