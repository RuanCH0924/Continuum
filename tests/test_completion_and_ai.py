"""Markdown 自动补全与 AI Provider 配置单元测试。"""

import json
import os
import shutil
import tempfile
import unittest

from continuum.ai.registry import ProviderRegistry
from continuum.ai.openai_provider import OpenAICompatibleProvider
from continuum.ai.base import ProviderConfig
from continuum.gui.markdown.completion import close_pair, continuation_prefix


class TestCompletion(unittest.TestCase):
    """成对符号与列表续行逻辑测试。"""

    def test_close_pair(self):
        self.assertEqual(close_pair("["), "]")
        self.assertEqual(close_pair("`"), "`")
        self.assertIsNone(close_pair("x"))

    def test_list_continuation(self):
        self.assertEqual(continuation_prefix("- 第一项"), "- ")
        self.assertEqual(continuation_prefix("1. 第一项"), "1. ")
        self.assertEqual(continuation_prefix("> 引用"), "> ")
        self.assertEqual(continuation_prefix("- [ ] 任务"), "- [ ] ")
        self.assertIsNone(continuation_prefix("普通文本"))
        self.assertIsNone(continuation_prefix(""))


class TestProviderRegistry(unittest.TestCase):
    """Provider 配置持久化与工厂测试（无网络）。"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="continuum_ai_")
        self.config_file = os.path.join(self.temp_dir, "ai_config.json")

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_save_and_load(self):
        registry = ProviderRegistry(config_file=self.config_file)
        registry.update(api_key="sk-test", base_url="https://example.com/v1", model="deepseek-chat")
        reloaded = ProviderRegistry(config_file=self.config_file)
        self.assertEqual(reloaded.config.api_key, "sk-test")
        self.assertEqual(reloaded.config.base_url, "https://example.com/v1")
        self.assertEqual(reloaded.config.model, "deepseek-chat")
        self.assertTrue(reloaded.is_configured())

    def test_defaults_when_missing(self):
        registry = ProviderRegistry(config_file=self.config_file)
        self.assertFalse(registry.is_configured())
        self.assertEqual(registry.config.provider, "openai-compatible")

    def test_create_provider(self):
        registry = ProviderRegistry(config_file=self.config_file)
        registry.update(api_key="k", base_url="https://example.com/v1")
        provider = registry.create_provider()
        self.assertIsInstance(provider, OpenAICompatibleProvider)
        self.assertEqual(provider._endpoint(), "https://example.com/v1/chat/completions")
        self.assertEqual(provider._headers()["Authorization"], "Bearer k")


if __name__ == "__main__":
    unittest.main()
