"""continuum.services - 业务数据层。

提供作品/章节文件存储与应用状态持久化，与界面完全解耦。
"""

from continuum.services.work_store import Chapter, WorkStore
from continuum.services.app_state import AppState

__all__ = ["Chapter", "WorkStore", "AppState"]
