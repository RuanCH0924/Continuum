"""Markdown 语法高亮（QSyntaxHighlighter）。"""

from PySide6.QtCore import QRegularExpression, Qt
from PySide6.QtGui import QColor, QFont, QSyntaxHighlighter, QTextCharFormat


class MarkdownSyntaxHighlighter(QSyntaxHighlighter):
    """基于正则规则的 Markdown 高亮，支持围栏代码块状态跟踪。"""

    def __init__(self, document, dark: bool = False):
        super().__init__(document)
        self._dark = dark
        self._rules = []
        self._reload_rules()

    # ---------------------------------------------------------- 主题
    def set_dark(self, dark: bool):
        self._dark = dark
        self._reload_rules()
        self.rehighlight()

    def _reload_rules(self):
        self._rules = []
        d = self._dark
        self._heading_fmt = self._fmt(QColor("#58a6ff" if d else "#0550ae"), bold=True)
        self._bold_fmt = self._fmt(QColor("#c9d1d9" if d else "#24292f"), bold=True)
        self._italic_fmt = self._fmt(QColor("#c9d1d9" if d else "#24292f"), italic=True)
        self._strike_fmt = self._fmt(QColor("#8b949e" if d else "#57606a"), strike=True)
        self._code_fmt = self._fmt(QColor("#e6edf3" if d else "#24292f"),
                                   bg=QColor("#161b22" if d else "#f6f8fa"), mono=True)
        self._codeblock_fmt = self._fmt(QColor("#a5d6ff" if d else "#0550ae"),
                                        bg=QColor("#161b22" if d else "#f6f8fa"))
        self._link_fmt = self._fmt(QColor("#58a6ff" if d else "#0969da"), underline=True)
        self._quote_fmt = self._fmt(QColor("#8b949e" if d else "#57606a"), italic=True)
        self._marker_fmt = self._fmt(QColor("#58a6ff" if d else "#0969da"))
        self._hr_fmt = self._fmt(QColor("#8b949e" if d else "#57606a"))

        rules = [
            (r"^#{1,6} .*$", self._heading_fmt),
            (r"^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?", self._marker_fmt),
            (r"^>.*$", self._quote_fmt),
            (r"^(---|\*\*\*|___)$", self._hr_fmt),
            (r"`[^`\n]+`", self._code_fmt),
            (r"\*\*[^*\n]+\*\*", self._bold_fmt),
            (r"~~[^~\n]+~~", self._strike_fmt),
            (r"\*[^*\n]+\*", self._italic_fmt),
            (r"\[[^\]]*\]\([^)\n]*\)", self._link_fmt),
            (r"!\[[^\]]*\]\([^)\n]*\)", self._link_fmt),
        ]
        for pattern, fmt in rules:
            self._rules.append((QRegularExpression(pattern), fmt))

    def _fmt(self, color: QColor, bold=False, italic=False, strike=False,
             underline=False, bg=None, mono=False) -> QTextCharFormat:
        fmt = QTextCharFormat()
        fmt.setForeground(color)
        if bold:
            fmt.setFontWeight(QFont.Weight.Bold)
        if italic:
            fmt.setFontItalic(True)
        if strike:
            fmt.setFontStrikeOut(True)
        if underline:
            fmt.setFontUnderline(True)
        if bg:
            fmt.setBackground(bg)
        if mono:
            fmt.setFontFamilies(["Consolas", "JetBrains Mono", "monospace"])
        return fmt

    # ------------------------------------------------------ 高亮主逻辑
    def highlightBlock(self, text: str):
        # 围栏代码块状态跟踪（state 1 = 代码块内）
        if self.previousBlockState() == 1:
            if text.strip().startswith("```"):
                self.setCurrentBlockState(0)
            else:
                self.setCurrentBlockState(1)
            self.setFormat(0, len(text), self._codeblock_fmt)
            return
        if text.strip().startswith("```"):
            self.setCurrentBlockState(1)
            self.setFormat(0, len(text), self._codeblock_fmt)
            return
        self.setCurrentBlockState(0)
        for regex, fmt in self._rules:
            iterator = regex.globalMatch(text)
            while iterator.hasNext():
                match = iterator.next()
                self.setFormat(match.capturedStart(), match.capturedLength(), fmt)
