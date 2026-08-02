"""continuum 包模块可导入性测试（引用路径冒烟验证）。"""

import importlib
import unittest

import continuum

# 包内全部模块，重构后引用路径应全部可解析
MODULES = [
    "continuum",
    "continuum.main",
    "continuum.config.settings",
    "continuum.config.coze_config",
    "continuum.core.coze_service",
    "continuum.core.hotkey_service",
    "continuum.core.transcription_service",
    "continuum.gui.app",
    "continuum.gui.components.hover_button",
    "continuum.utils.clipboard_utils",
    "continuum.utils.random_utils",
]


class TestModuleImports(unittest.TestCase):
    """验证重构后的模块引用路径无错误。"""

    def test_all_modules_importable(self):
        for module in MODULES:
            with self.subTest(module=module):
                importlib.import_module(module)

    def test_package_metadata(self):
        self.assertEqual(continuum.__version__, "0.1.0")
        self.assertEqual(continuum.__license__, "MIT")


if __name__ == "__main__":
    unittest.main()
