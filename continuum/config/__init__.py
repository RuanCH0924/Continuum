"""continuum.config - 配置管理子包。

包含应用基础设置（settings）与 AI 服务凭证配置（coze_config）。
"""

from continuum.config.settings import (
    THEME_CONFIG,
    APP_CONFIG,
    HOTKEY_CONFIG,
    RANDOM_GENERATION_CONFIG,
)

__all__ = [
    "THEME_CONFIG",
    "APP_CONFIG",
    "HOTKEY_CONFIG",
    "RANDOM_GENERATION_CONFIG",
]
