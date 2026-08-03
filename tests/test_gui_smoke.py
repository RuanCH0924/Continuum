"""GUI 冒烟测试：无显示环境下构建主窗口并验证核心交互。"""

import os
import unittest

# 必须在创建 QApplication 之前设置，避免依赖真实显示环境
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtWidgets import QApplication  # noqa: E402

from continuum.config.settings import APP_CONFIG  # noqa: E402
from continuum.gui.app import MainWindow  # noqa: E402
from continuum.gui.views.editor_pane import MODE_PREVIEW  # noqa: E402


class TestMainWindowSmoke(unittest.TestCase):
    """主窗口构建与基本交互冒烟测试。"""

    @classmethod
    def setUpClass(cls):
        cls.app = QApplication.instance() or QApplication([])

    def _create_window(self):
        window = MainWindow()
        self.addCleanup(window.close)
        self.addCleanup(window.cleanup)
        return window

    def test_window_constructs(self):
        """主窗口可构建，核心视图与服务就绪。"""
        window = self._create_window()
        self.assertEqual(window.windowTitle(), APP_CONFIG["window_title"])
        self.assertIsNotNone(window.editor_pane)
        self.assertIsNotNone(window.sidebar)
        self.assertIsNotNone(window.ai_panel)
        self.assertIsNotNone(window.tools_panel)
        self.assertIsNotNone(window.markdown_toolbar)

    def test_editor_text_and_word_count(self):
        """编辑区文本与字数统计联动（保留原始文本，不做破坏性处理）。"""
        window = self._create_window()
        window.editor_pane.set_text("第一行\n\n  第二行  ")
        self.assertEqual(window.editor_pane.text(), "第一行\n\n  第二行  ")
        self.assertIn("字数：6", window.word_count_label.text())

    def test_editor_modes(self):
        """三种模式切换。"""
        window = self._create_window()
        window._set_mode("edit")
        self.assertEqual(window.editor_pane.mode(), "edit")
        window._set_mode("preview")
        self.assertEqual(window.editor_pane.mode(), "preview")
        window._set_mode("split")
        self.assertEqual(window.editor_pane.mode(), "split")

    def test_theme_toggle(self):
        """暗色主题切换不报错并更新预览。"""
        window = self._create_window()
        window._apply_theme(True)
        self.assertTrue(window.theme_action.isChecked())
        window._apply_theme(False)
        self.assertFalse(window.theme_action.isChecked())

    def test_markdown_editor_format_action(self):
        """工具栏格式化动作。"""
        window = self._create_window()
        editor = window.editor_pane.editor
        editor.setPlainText("")
        editor.apply_format_action("bold")
        self.assertIn("**", editor.toPlainText())


if __name__ == "__main__":
    unittest.main()
