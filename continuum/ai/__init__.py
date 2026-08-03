"""continuum.ai - 统一 AI 适配层。

支持任意 OpenAI 兼容接口（OpenAI / DeepSeek / 硅基流动 / Ollama 等），
通过三段式配置（api_key + base_url + model）即可接入。
"""

from continuum.ai.base import ChatMessage, LLMProvider, ProviderConfig
from continuum.ai.openai_provider import OpenAICompatibleProvider
from continuum.ai.registry import ProviderRegistry

__all__ = [
    "ChatMessage",
    "LLMProvider",
    "ProviderConfig",
    "OpenAICompatibleProvider",
    "ProviderRegistry",
]
