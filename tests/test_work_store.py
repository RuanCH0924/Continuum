"""作品/章节文件存储测试（使用临时目录，不污染真实数据）。"""

import os
import shutil
import tempfile
import unittest

from continuum.services.work_store import WorkStore


class TestWorkStore(unittest.TestCase):
    """WorkStore 作品/章节增删改查与文件落盘测试。"""

    def setUp(self):
        self.temp_dir = tempfile.mkdtemp(prefix="continuum_test_")
        self.store = WorkStore(works_dir=self.temp_dir)

    def tearDown(self):
        shutil.rmtree(self.temp_dir, ignore_errors=True)

    def test_create_and_list_work(self):
        meta = self.store.create_work("测试作品", "描述")
        works = self.store.list_works()
        self.assertEqual(len(works), 1)
        self.assertEqual(works[0]["title"], "测试作品")
        self.assertEqual(meta["id"], works[0]["id"])

    def test_chapter_roundtrip(self):
        meta = self.store.create_work("测试作品")
        chapter = self.store.create_chapter(meta["id"], "第一章", "# 第一章\n\n正文内容")
        self.assertEqual(chapter.index, 1)

        chapters = self.store.list_chapters(meta["id"])
        self.assertEqual(len(chapters), 1)
        self.assertEqual(self.store.read_chapter(chapters[0]), "# 第一章\n\n正文内容")

    def test_chapter_rename_keeps_order(self):
        meta = self.store.create_work("测试作品")
        c1 = self.store.create_chapter(meta["id"], "第一章", "内容A")
        self.store.create_chapter(meta["id"], "第二章", "内容B")
        # 重命名第一章，应仍为 001 且无残留旧文件
        self.store.save_chapter(meta["id"], c1.index, "第一章（改）", "内容A2")
        chapters = self.store.list_chapters(meta["id"])
        self.assertEqual(len(chapters), 2)
        self.assertEqual(chapters[0].title, "第一章（改）")
        self.assertEqual(self.store.read_chapter(chapters[0]), "内容A2")

    def test_delete_chapter_and_work(self):
        meta = self.store.create_work("测试作品")
        chapter = self.store.create_chapter(meta["id"], "第一章")
        self.assertTrue(self.store.delete_chapter(meta["id"], chapter.index))
        self.assertEqual(self.store.list_chapters(meta["id"]), [])
        self.assertTrue(self.store.delete_work(meta["id"]))
        self.assertEqual(self.store.list_works(), [])

    def test_title_fallback_to_h1(self):
        """无索引文件（旧版数据）时，标题回退到正文 H1。"""
        meta = self.store.create_work("测试作品")
        self.store.create_chapter(meta["id"], "临时名", "# 真正的标题\n内容")
        os.remove(self.store._chapters_index_file(meta["id"]))
        chapters = self.store.list_chapters(meta["id"])
        self.assertEqual(chapters[0].title, "真正的标题")


if __name__ == "__main__":
    unittest.main()
