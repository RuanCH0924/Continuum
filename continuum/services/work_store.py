"""作品 / 章节文件存储。

目录结构：
    data/works/<work_id>/
        meta.json          # {id, title, description, created_at, updated_at}
        chapters/
            <n>_<slug>.md  # 章节正文（n 为零填充序号，slug 由标题生成）
"""

import json
import os
import re
import shutil
import time
from typing import Dict, List, Optional

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "data")
WORKS_DIR = os.path.join(DATA_DIR, "works")


def _slugify(text: str) -> str:
    text = re.sub(r"[^\w\u4e00-\u9fff-]", "", text).strip() or "untitled"
    return text[:20]


class Chapter:
    """章节模型。"""

    def __init__(self, work_id: str, index: int, title: str, file_path: str, content: str = ""):
        self.work_id = work_id
        self.index = index
        self.title = title
        self.file_path = file_path
        self.content = content

    @property
    def id(self) -> str:
        return f"{self.work_id}:{self.index}"


class WorkStore:
    """作品/章节本地文件存储。"""

    def __init__(self, works_dir: str = WORKS_DIR):
        self.works_dir = works_dir

    # ------------------------------------------------------------- 作品
    def list_works(self) -> List[Dict]:
        """返回按更新时间倒序的作品元数据列表。"""
        result = []
        if not os.path.isdir(self.works_dir):
            return result
        for name in os.listdir(self.works_dir):
            meta_file = os.path.join(self.works_dir, name, "meta.json")
            if os.path.isfile(meta_file):
                try:
                    with open(meta_file, "r", encoding="utf-8") as f:
                        meta = json.load(f)
                    meta["id"] = name
                    result.append(meta)
                except (OSError, json.JSONDecodeError):
                    continue
        result.sort(key=lambda m: m.get("updated_at", 0), reverse=True)
        return result

    def get_work(self, work_id: str) -> Optional[Dict]:
        for work in self.list_works():
            if work["id"] == work_id:
                return work
        return None

    def create_work(self, title: str, description: str = "") -> Dict:
        work_id = f"work_{int(time.time() * 1000)}"
        path = os.path.join(self.works_dir, work_id)
        os.makedirs(os.path.join(path, "chapters"), exist_ok=True)
        meta = {
            "id": work_id,
            "title": title,
            "description": description,
            "created_at": int(time.time()),
            "updated_at": int(time.time()),
        }
        self._write_json(os.path.join(path, "meta.json"), meta)
        return meta

    def rename_work(self, work_id: str, title: str) -> bool:
        meta = self.get_work(work_id)
        if not meta:
            return False
        meta["title"] = title
        return self._write_json(os.path.join(self.works_dir, work_id, "meta.json"), meta)

    def delete_work(self, work_id: str) -> bool:
        path = os.path.join(self.works_dir, work_id)
        if os.path.isdir(path):
            shutil.rmtree(path, ignore_errors=True)
            return True
        return False

    def _touch_work(self, work_id: str):
        meta_file = os.path.join(self.works_dir, work_id, "meta.json")
        try:
            with open(meta_file, "r", encoding="utf-8") as f:
                meta = json.load(f)
            meta["updated_at"] = int(time.time())
            self._write_json(meta_file, meta)
        except (OSError, json.JSONDecodeError):
            pass

    # ------------------------------------------------------------ 章节
    def _chapters_index_file(self, work_id: str) -> str:
        return os.path.join(self.works_dir, work_id, "chapters", "index.json")

    def _load_chapters_index(self, work_id: str) -> Dict:
        try:
            with open(self._chapters_index_file(work_id), "r", encoding="utf-8") as f:
                data = json.load(f)
            return data if isinstance(data, dict) else {}
        except (OSError, json.JSONDecodeError):
            return {}

    def _save_chapters_index(self, work_id: str, index: Dict) -> bool:
        return self._write_json(self._chapters_index_file(work_id), index)

    def list_chapters(self, work_id: str) -> List[Chapter]:
        chapters_dir = os.path.join(self.works_dir, work_id, "chapters")
        result = []
        if not os.path.isdir(chapters_dir):
            return result
        index = self._load_chapters_index(work_id)
        for name in os.listdir(chapters_dir):
            if not name.endswith(".md"):
                continue
            match = re.match(r"^(\d+)_(.*)\.md$", name)
            if not match:
                continue
            file_path = os.path.join(chapters_dir, name)
            idx = int(match.group(1))
            chapter = Chapter(work_id=work_id, index=idx, title=match.group(2), file_path=file_path)
            chapter.title = index.get(str(idx)) or self._chapter_title(file_path) or chapter.title
            result.append(chapter)
        result.sort(key=lambda c: c.index)
        return result

    def get_chapter(self, work_id: str, index: int) -> Optional[Chapter]:
        for chapter in self.list_chapters(work_id):
            if chapter.index == index:
                return chapter
        return None

    def create_chapter(self, work_id: str, title: str, content: str = "") -> Chapter:
        chapters = self.list_chapters(work_id)
        index = chapters[-1].index + 1 if chapters else 1
        return self.save_chapter(work_id, index, title, content)

    def save_chapter(self, work_id: str, index: int, title: str, content: str) -> Chapter:
        chapters_dir = os.path.join(self.works_dir, work_id, "chapters")
        os.makedirs(chapters_dir, exist_ok=True)
        # 移除同序号的旧文件（标题变更时避免残留）
        for name in os.listdir(chapters_dir):
            if name.endswith(".md") and re.match(rf"^{index:03d}_.*\.md$", name):
                os.remove(os.path.join(chapters_dir, name))
        file_path = os.path.join(chapters_dir, f"{index:03d}_{_slugify(title)}.md")
        with open(file_path, "w", encoding="utf-8") as f:
            f.write(content)
        # 持久化章节标题（支持重命名）
        index_data = self._load_chapters_index(work_id)
        index_data[str(index)] = title
        self._save_chapters_index(work_id, index_data)
        self._touch_work(work_id)
        return Chapter(work_id, index, title, file_path, content)

    def read_chapter(self, chapter: Chapter) -> str:
        try:
            with open(chapter.file_path, "r", encoding="utf-8") as f:
                return f.read()
        except OSError:
            return ""

    def delete_chapter(self, work_id: str, index: int) -> bool:
        for chapter in self.list_chapters(work_id):
            if chapter.index == index:
                try:
                    os.remove(chapter.file_path)
                    index_data = self._load_chapters_index(work_id)
                    index_data.pop(str(index), None)
                    self._save_chapters_index(work_id, index_data)
                    self._touch_work(work_id)
                    return True
                except OSError:
                    return False
        return False

    # ------------------------------------------------------------- 工具
    def _chapter_title(self, file_path: str) -> Optional[str]:
        try:
            with open(file_path, "r", encoding="utf-8") as f:
                for line in f:
                    match = re.match(r"^#\s+(.+)", line.strip())
                    if match:
                        return match.group(1).strip()
        except OSError:
            pass
        return None

    def _write_json(self, path: str, data: dict) -> bool:
        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            with open(path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            return True
        except OSError:
            return False
