"""Markdown 输入自动补全：成对符号自动闭合、列表/引用自动续行。"""

import re
from typing import Optional

# 成对符号：输入左符号时自动补全右符号
AUTO_PAIRS = {
    "(": ")",
    "[": "]",
    "{": "}",
    "`": "`",
    '"': '"',
    "'": "'",
}

_LIST_ITEM_RE = re.compile(r"^(\s*)([-*+]|\d+[.)])\s+(\[[ xX]\]\s+)?")
_QUOTE_RE = re.compile(r"^(\s*)>\s?")


def continuation_prefix(line: str) -> Optional[str]:
    """计算列表项/引用的续行前缀；非续行场景返回 None。"""
    match = _LIST_ITEM_RE.match(line)
    if match:
        indent, marker, task = match.group(1), match.group(2), match.group(3) or ""
        return f"{indent}{marker} {task}"
    match = _QUOTE_RE.match(line)
    if match:
        return f"{match.group(1)}> "
    return None


def close_pair(open_char: str) -> Optional[str]:
    """返回左符号对应的右符号。"""
    return AUTO_PAIRS.get(open_char)
