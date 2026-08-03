"""码字编辑视图：文本输入、剪贴板自动加载、随机生成、字数统计。"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (QCheckBox, QHBoxLayout, QLabel, QLineEdit,
                               QPlainTextEdit, QVBoxLayout, QWidget)

from continuum.config.settings import RANDOM_GENERATION_CONFIG, THEME_CONFIG
from continuum.gui.components.buttons import styled_button
from continuum.utils.random_utils import RandomChineseGenerator


class EditorView(QWidget):
    """主编辑区。"""

    # 请求写入操作日志（交由主窗口统一处理）
    log_requested = Signal(str)

    def __init__(self, parent=None):
        super().__init__(parent)
        self.random_generator = RandomChineseGenerator(
            start_unicode=RANDOM_GENERATION_CONFIG["chinese_start_unicode"],
            end_unicode=RANDOM_GENERATION_CONFIG["chinese_end_unicode"],
        )

        # 文本编辑区
        self.text_edit = QPlainTextEdit(self)
        self.text_edit.setPlaceholderText("在此输入或粘贴文本…")

        # 顶部控制行：剪贴板开关 + 字数统计
        self.auto_paste_check = QCheckBox("自动加载剪贴板内容", self)
        self.word_count_label = QLabel("字数：0", self)
        self.word_count_label.setStyleSheet(
            f"font-weight: bold; color: {THEME_CONFIG['text_color']};"
        )

        # 随机生成行
        self.word_num_edit = QLineEdit(str(RANDOM_GENERATION_CONFIG["default_words"]), self)
        self.word_num_edit.setFixedWidth(80)
        self.word_num_edit.setAlignment(Qt.AlignCenter)
        self.generate_button = styled_button(
            "随机生成", THEME_CONFIG["primary_color"], THEME_CONFIG["button_hover_color"], width=100
        )

        top_row = QHBoxLayout()
        top_row.addWidget(self.auto_paste_check)
        top_row.addWidget(self.word_count_label)
        top_row.addStretch()

        gen_row = QHBoxLayout()
        gen_row.addWidget(QLabel("随机生成字数：", self))
        gen_row.addWidget(self.word_num_edit)
        gen_row.addWidget(self.generate_button)
        gen_row.addStretch()

        layout = QVBoxLayout(self)
        layout.addLayout(top_row)
        layout.addWidget(self.text_edit, stretch=1)
        layout.addLayout(gen_row)

        # 事件绑定
        self.text_edit.textChanged.connect(self._update_word_count)
        self.generate_button.clicked.connect(self.generate_random_chinese)

    @property
    def auto_paste_enabled(self) -> bool:
        return self.auto_paste_check.isChecked()

    def plain_text(self) -> str:
        return self.text_edit.toPlainText().strip()

    def set_text(self, text: str) -> None:
        """设置文本内容（去除行首尾空格与空行）。"""
        processed = "\n".join(line.strip() for line in text.split("\n") if line.strip())
        if processed != self.plain_text():
            self.text_edit.setPlainText(processed)
            self._update_word_count()

    def clear(self) -> None:
        self.text_edit.clear()

    def word_count(self) -> int:
        return len(self.plain_text().replace(" ", "").replace("\n", ""))

    def _update_word_count(self) -> None:
        self.word_count_label.setText(f"字数：{self.word_count()}")

    def generate_random_chinese(self) -> None:
        """生成随机中文内容。"""
        target = self.random_generator.validate_word_count(
            self.word_num_edit.text(),
            RANDOM_GENERATION_CONFIG["min_words"],
            RANDOM_GENERATION_CONFIG["max_words"],
            RANDOM_GENERATION_CONFIG["default_words"],
        )
        self.word_num_edit.setText(str(target))
        self.log_requested.emit(f"正在生成{target}字随机中文内容...")
        self.text_edit.setPlainText(self.random_generator.generate(target))
        self.log_requested.emit(f"{target}字随机内容生成完成")
