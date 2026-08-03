"""AI 适配层 - 统一 Provider 抽象与配置模型。"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Callable, List, Optional


@dataclass
class ChatMessage:
    """对话消息。"""

    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class ProviderConfig:
    """OpenAI 兼容接口的三段式配置。"""

    provider: str = "openai-compatible"
    api_key: str = ""
    base_url: str = "https://api.openai.com/v1"
    model: str = "gpt-4o-mini"
    temperature: float = 0.7


class LLMProvider(ABC):
    """统一模型提供方接口（OpenAI 兼容协议）。"""

    def __init__(self, config: ProviderConfig):
        self.config = config

    @abstractmethod
    def chat_stream(
        self,
        messages: List[ChatMessage],
        on_delta: Optional[Callable[[str], None]] = None,
    ) -> str:
        """流式对话。逐块回调 on_delta，返回完整回复文本；失败抛 RuntimeError。"""

    @abstractmethod
    def validate(self) -> tuple:
        """校验配置有效性，返回 (is_valid: bool, error: str)。"""
