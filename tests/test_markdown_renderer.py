"""GFM Markdown 渲染器测试。"""

import unittest

from continuum.gui.markdown.renderer import render_markdown


class TestMarkdownRenderer(unittest.TestCase):
    """验证标准 GFM 语法渲染结果。"""

    def test_heading_and_bold(self):
        html = render_markdown("# 标题\n\n**加粗**")
        self.assertIn("<h1>", html)
        self.assertIn("标题", html)
        self.assertIn("<strong>加粗</strong>", html)

    def test_table_gfm(self):
        html = render_markdown("| a | b |\n|---|---|\n| 1 | 2 |")
        self.assertIn("<table>", html)

    def test_strikethrough(self):
        html = render_markdown("~~删除线~~")
        self.assertIn("<s>删除线</s>", html)

    def test_code_block(self):
        html = render_markdown("```python\nprint(1)\n```")
        self.assertIn("<pre>", html)

    def test_task_list(self):
        html = render_markdown("- [x] 已完成\n- [ ] 未完成")
        # 启用任务列表扩展时应渲染 checkbox
        self.assertIn("checkbox", html)

    def test_dark_theme_css(self):
        html_light = render_markdown("# t", dark=False)
        html_dark = render_markdown("# t", dark=True)
        self.assertNotEqual(html_light, html_dark)
        self.assertIn("markdown-body", html_dark)

    def test_empty_text(self):
        self.assertIn("markdown-body", render_markdown(""))


if __name__ == "__main__":
    unittest.main()
