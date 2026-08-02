"""continuum.config 配置模块测试。"""

import os
import unittest

from continuum.config.coze_config import CozeConfig

# 测试专用配置文件，避免污染真实配置
TEST_CONFIG_FILE = "coze_config_test.json"


class TestCozeConfig(unittest.TestCase):
    """CozeConfig 配置读写与校验测试。"""

    def setUp(self):
        self.config = CozeConfig(config_file=TEST_CONFIG_FILE)
        # 清理历史残留
        if os.path.exists(self.config.config_file):
            os.remove(self.config.config_file)

    def tearDown(self):
        if os.path.exists(self.config.config_file):
            os.remove(self.config.config_file)

    def test_default_config_not_configured(self):
        """未配置时 is_configured 应为 False。"""
        self.assertFalse(self.config.is_configured())

    def test_update_config_roundtrip(self):
        """配置写入后可正确读取并标记为已配置。"""
        self.assertTrue(self.config.update_config("test-token", "test-user"))
        reloaded = CozeConfig(config_file=TEST_CONFIG_FILE)
        self.assertTrue(reloaded.is_configured())
        self.assertEqual(reloaded.get("token"), "test-token")
        self.assertEqual(reloaded.get("user_id"), "test-user")

    def test_reset_config(self):
        """重置后恢复默认配置。"""
        self.config.update_config("test-token", "test-user")
        self.config.reset_config()
        reloaded = CozeConfig(config_file=TEST_CONFIG_FILE)
        self.assertFalse(reloaded.is_configured())
        self.assertEqual(reloaded.get("token"), "")

    def test_load_broken_json_falls_back_to_default(self):
        """配置文件损坏时回退到默认配置。"""
        with open(self.config.config_file, "w", encoding="utf-8") as f:
            f.write("{ invalid json !!!")
        reloaded = CozeConfig(config_file=TEST_CONFIG_FILE)
        self.assertEqual(reloaded.get("token"), "")
        self.assertFalse(reloaded.is_configured())


if __name__ == "__main__":
    unittest.main()
