#!/usr/bin/env python3
"""续言 Continuum - 启动入口脚本。

用法：
    python run.py          # 命令行启动
    python -m continuum    # 模块方式启动
"""

import sys
import os

# 将项目根目录加入 Python 路径，保证包内绝对导入可用
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from continuum.main import main

if __name__ == "__main__":
    main()
