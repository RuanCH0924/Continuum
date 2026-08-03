"""AI Provider 配置注册与管理（配置持久化到 data/ai_config.json）。"""

import json
import os

from continuum.ai.base import LLMProvider, ProviderConfig
from continuum.ai.openai_provider import OpenAICompatibleProvider

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
AI_CONFIG_FILE = os.path.join(DATA_DIR, "ai_config.json")


class ProviderRegistry:
    """Provider 工厂与配置持久化。"""

    def __init__(self, config_file: str = AI_CONFIG_FILE):
        self.config_file = config_file
        self._config = self._load()

    def _load(self) -> ProviderConfig:
        config = ProviderConfig()
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                for key in ("provider", "api_key", "base_url", "model", "temperature"):
                    if key in data:
                        setattr(config, key, data[key])
        except (OSError, json.JSONDecodeError):
            pass
        return config

    def save(self) -> bool:
        try:
            os.makedirs(os.path.dirname(self.config_file), exist_ok=True)
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self._config.__dict__, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False

    @property
    def config(self) -> ProviderConfig:
        return self._config

    def update(self, **kwargs) -> bool:
        for key, value in kwargs.items():
            if hasattr(self._config, key):
                setattr(self._config, key, value)
        return self.save()

    def is_configured(self) -> bool:
        return bool(self._config.api_key)

    def create_provider(self) -> LLMProvider:
        return OpenAICompatibleProvider(self._config)
