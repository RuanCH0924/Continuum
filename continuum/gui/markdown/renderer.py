"""GFM Markdown 渲染器：Markdown -> 完整 HTML（内嵌 CSS），支持亮/暗主题。

基于 markdown-it-py（gfm-like 预设），任务列表等扩展在可用时自动启用。
"""

from markdown_it import MarkdownIt

try:  # 任务列表扩展（可选）
    from mdit_py_plugins.tasklists import tasklists_plugin
    _md = MarkdownIt("gfm-like").use(tasklists_plugin)
except ImportError:
    _md = MarkdownIt("gfm-like")

_BODY_CSS = """
body.markdown-body {{
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Microsoft YaHei",
                 "PingFang SC", "Noto Sans CJK SC", sans-serif;
    font-size: 15px; line-height: 1.75; margin: 0 auto; padding: 24px 28px;
    max-width: 820px; word-wrap: break-word;
}}
.markdown-body h1, .markdown-body h2 {{
    border-bottom: 1px solid {border}; padding-bottom: .3em;
}}
.markdown-body h1 {{ font-size: 1.9em; }} .markdown-body h2 {{ font-size: 1.5em; }}
.markdown-body h3 {{ font-size: 1.25em; }}
.markdown-body code {{
    font-family: "JetBrains Mono", Consolas, "Courier New", monospace;
    font-size: .9em; padding: .15em .4em; border-radius: 4px;
    background: {code_bg}; color: {code_fg};
}}
.markdown-body pre {{ background: {code_bg}; padding: 14px 16px; border-radius: 8px; overflow-x: auto; }}
.markdown-body pre code {{ background: transparent; padding: 0; }}
.markdown-body blockquote {{
    margin: 0; padding: .2em 1em; color: {quote_fg};
    border-left: 4px solid {quote_border}; background: {quote_bg};
}}
.markdown-body table {{ border-collapse: collapse; width: 100%; margin: 12px 0; }}
.markdown-body th, .markdown-body td {{
    border: 1px solid {border}; padding: 8px 12px; text-align: left;
}}
.markdown-body th {{ background: {th_bg}; font-weight: 600; }}
.markdown-body a {{ color: {link}; text-decoration: none; }}
.markdown-body a:hover {{ text-decoration: underline; }}
.markdown-body hr {{ border: none; border-top: 2px solid {border}; margin: 20px 0; }}
.markdown-body img {{ max-width: 100%; border-radius: 6px; }}
.markdown-body ul, .markdown-body ol {{ padding-left: 1.6em; }}
.markdown-body li {{ margin: .25em 0; }}
.markdown-body input[type="checkbox"] {{ margin-right: .4em; }}
.markdown-body del {{ color: {quote_fg}; }}
.markdown-body blockquote, .markdown-body pre {{
    border-radius: 8px;
}}
"""

_LIGHT = {
    "border": "#d0d7de", "code_bg": "#f6f8fa", "code_fg": "#24292f",
    "quote_fg": "#57606a", "quote_border": "#d0d7de", "quote_bg": "#f6f8fa",
    "th_bg": "#f6f8fa", "link": "#0969da",
}

_DARK = {
    "border": "#30363d", "code_bg": "#161b22", "code_fg": "#e6edf3",
    "quote_fg": "#8b949e", "quote_border": "#30363d", "quote_bg": "#0d1117",
    "th_bg": "#161b22", "link": "#58a6ff",
}


def render_markdown(text: str, dark: bool = False) -> str:
    """渲染 Markdown 为完整 HTML 文档。"""
    theme = _DARK if dark else _LIGHT
    css = _BODY_CSS.format(**theme)
    body = _md.render(text or "")
    return (
        "<!DOCTYPE html><html><head><meta charset='utf-8'>"
        f"<style>{css}</style></head>"
        f"<body class='markdown-body'>{body}</body></html>"
    )
