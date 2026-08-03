"""左侧栏：作品/章节树 + 当前章节大纲（标题导航）。"""

from PySide6.QtCore import Qt, Signal
from PySide6.QtWidgets import (QHBoxLayout, QPushButton, QTabWidget, QTreeWidget,
                               QTreeWidgetItem, QVBoxLayout, QWidget)

from continuum.gui.components.buttons import styled_button
from continuum.gui.theme import PRIMARY_COLOR, BUTTON_HOVER_COLOR

_USER_ROLE = Qt.UserRole


class WorkSidebar(QWidget):
    """作品与章节管理侧栏。"""

    new_work_requested = Signal()
    new_chapter_requested = Signal()
    delete_work_requested = Signal(str)
    delete_chapter_requested = Signal(int)
    work_activated = Signal(str)          # work_id
    chapter_activated = Signal(int)       # chapter index
    outline_activated = Signal(int)       # 章节内 block number

    def __init__(self, parent=None):
        super().__init__(parent)
        self.current_work_id = ""

        # 顶部操作按钮
        self.new_work_button = styled_button("新建作品", PRIMARY_COLOR, BUTTON_HOVER_COLOR, width=88)
        self.new_chapter_button = styled_button("新建章节", "#6f42c1", "#5a32a3", width=88)
        self.delete_button = styled_button("删除", "#e74c3c", "#c0392b", width=64)

        top_row = QHBoxLayout()
        top_row.addWidget(self.new_work_button)
        top_row.addWidget(self.new_chapter_button)
        top_row.addWidget(self.delete_button)
        top_row.addStretch()

        # 作品树：作品 -> 章节
        self.work_tree = QTreeWidget(self)
        self.work_tree.setHeaderLabel("作品")
        self.work_tree.itemClicked.connect(self._on_work_item_clicked)

        # 大纲树：当前章节标题
        self.outline_tree = QTreeWidget(self)
        self.outline_tree.setHeaderLabel("大纲")
        self.outline_tree.itemClicked.connect(self._on_outline_clicked)

        tabs = QTabWidget(self)
        tabs.addTab(self.work_tree, "作品")
        tabs.addTab(self.outline_tree, "大纲")

        layout = QVBoxLayout(self)
        layout.addLayout(top_row)
        layout.addWidget(tabs)

        self.new_work_button.clicked.connect(self.new_work_requested.emit)
        self.new_chapter_button.clicked.connect(self.new_chapter_requested.emit)
        self.delete_button.clicked.connect(self._on_delete_clicked)

    # ------------------------------------------------------- 数据装载
    def load_works(self, works: list, selected_work_id: str = ""):
        self.work_tree.clear()
        self.current_work_id = selected_work_id
        for work in works:
            item = QTreeWidgetItem([work.get("title", "未命名作品")])
            item.setData(0, _USER_ROLE, ("work", work["id"]))
            self.work_tree.addTopLevelItem(item)
            if work["id"] == selected_work_id:
                self.work_tree.setCurrentItem(item)
                item.setExpanded(True)

    def load_chapters(self, chapters: list, selected_index: int = 0):
        if not self.current_work_id:
            return
        root = self.work_tree.currentItem()
        if root is None:
            return
        # 清空章节子节点
        root.takeChildren()
        for chapter in chapters:
            child = QTreeWidgetItem([chapter.title])
            child.setData(0, _USER_ROLE, ("chapter", chapter.index))
            root.addChild(child)
            if chapter.index == selected_index:
                self.work_tree.setCurrentItem(child)
        root.setExpanded(True)

    def set_outline(self, items: list):
        """items: [(level, title, block_number), ...]"""
        self.outline_tree.clear()
        stack = {}
        for level, title, block_number in items:
            item = QTreeWidgetItem([("  " * (level - 1)) + title])
            item.setData(0, _USER_ROLE, ("outline", block_number))
            if level <= 1:
                self.outline_tree.addTopLevelItem(item)
            else:
                parent = stack.get(level - 1)
                if parent is not None:
                    parent.addChild(item)
                else:
                    self.outline_tree.addTopLevelItem(item)
            stack[level] = item
            # 清理更深层的旧引用
            for key in list(stack.keys()):
                if key > level:
                    del stack[key]

    # ------------------------------------------------------- 事件
    def _on_work_item_clicked(self, item, _column):
        kind, value = item.data(0, _USER_ROLE)
        if kind == "work":
            self.current_work_id = value
            self.work_activated.emit(value)
        elif kind == "chapter":
            self.current_work_id = self._current_work_id()
            self.chapter_activated.emit(value)

    def _current_work_id(self) -> str:
        item = self.work_tree.currentItem()
        while item is not None and item.data(0, _USER_ROLE)[0] != "work":
            item = item.parent()
        if item is not None:
            return item.data(0, _USER_ROLE)[1]
        return self.current_work_id

    def _on_outline_clicked(self, item, _column):
        kind, block_number = item.data(0, _USER_ROLE)
        if kind == "outline":
            self.outline_activated.emit(block_number)

    def _on_delete_clicked(self):
        item = self.work_tree.currentItem()
        if item is None:
            return
        kind, value = item.data(0, _USER_ROLE)
        if kind == "work":
            self.delete_work_requested.emit(value)
        elif kind == "chapter":
            self.delete_chapter_requested.emit(value)
