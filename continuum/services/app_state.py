"""应用状态持久化（主题/布局模式/最近打开的作品章节等）。"""

import json
import os
from typing import Any

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
STATE_FILE = os.path.join(DATA_DIR, "state.json")


class AppState:
    """轻量应用状态存取。"""

    DEFAULTS = {
        "theme": "light",          # light | dark
        "editor_mode": "split",    # edit | split | preview
        "last_work": "",
        "last_chapter_index": 0,
        "autosave_interval": 30,   # 秒
    }

    def __init__(self, state_file: str = STATE_FILE):
        self.state_file = state_file
        self._data = dict(self.DEFAULTS)
        self._data.update(self._load())

    def _load(self) -> dict:
        try:
            if os.path.exists(self.state_file):
                with open(self.state_file, "r", encoding="utf-8") as f:
                    return json.load(f)
        except (OSError, json.JSONDecodeError):
            pass
        return {}

    def save(self) -> bool:
        try:
            os.makedirs(os.path.dirname(self.state_file), exist_ok=True)
            with open(self.state_file, "w", encoding="utf-8") as f:
                json.dump(self._data, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False

    def get(self, key: str, default: Any = None) -> Any:
        return self._data.get(key, default)

    def set(self, key: str, value: Any):
        self._data[key] = value
        self.save()
