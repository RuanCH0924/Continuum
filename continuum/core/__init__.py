"""continuum.core - 核心服务层。

封装与业务能力相关的服务，供 GUI 层调用：
- coze_service: AI 服务通信（流式对话、配置校验、请求取消）
- hotkey_service: 全局热键注册与监听
- transcription_service: 跨窗口文本录入
"""

from continuum.core.coze_service import CozeService
from continuum.core.hotkey_service import HotkeyService
from continuum.core.transcription_service import TranscriptionService

__all__ = ["CozeService", "HotkeyService", "TranscriptionService"]
