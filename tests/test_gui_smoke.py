"""GUI 冒烟测试：无显示环境下构建主窗口并验证服务初始化与基本交互。"""

import os
import unittest

# 必须在创建 QApplication 之前设置，避免依赖真实显示环境
os.environ.setdefault("QT_QPA_PLATFORM", "offscreen")

from PySide6.QtWidgets import QApplication  # noqa: E402

from continuum.config.settings import APP_CONFIG  # noqa: E402
from continuum.gui.app import MainWindow  # noqa: E402


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
        """主窗口可构建，标题与核心视图就绪。"""
        window = self._create_window()
        self.assertEqual(window.windowTitle(), APP_CONFIG["window_title"])
        self.assertIsNotNone(window.editor)
        self.assertIsNotNone(window.log_view)
        self.assertIsNotNone(window.start_button)
        self.assertIsNotNone(window.enhance_button)

    def test_editor_interactions(self):
        """编辑区文本处理与字数统计。"""
        window = self._create_window()
        window.editor.set_text("第一行\n\n  第二行  ")
        self.assertEqual(window.editor.plain_text(), "第一行\n第二行")
        self.assertEqual(window.editor.word_count(), 6)
        window.add_log("冒烟测试日志")
        self.assertIn("冒烟测试日志", window.log_view._text.toPlainText())

    def test_topmost_toggle(self):
        """窗口置顶开关往返切换不报错。"""
        window = self._create_window()
        window.toggle_topmost()
        self.assertFalse(window.is_topmost)
        window.toggle_topmost()
        self.assertTrue(window.is_topmost)

    def test_mode_toggle(self):
        """快/慢速录入模式切换。"""
        window = self._create_window()
        window.toggle_typing_mode()
        self.assertFalse(window.fast_mode)
        window.toggle_typing_mode()
        self.assertTrue(window.fast_mode)


if __name__ == "__main__":
    unittest.main()
