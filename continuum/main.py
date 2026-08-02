#!/usr/bin/env python3
"""续言 Continuum 主入口文件"""

import logging
import os

# 配置日志
log_dir = os.path.join(os.path.dirname(__file__), "..", "logs")
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, "continuum.log")

# 设置日志格式
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler()
    ]
)

from continuum.gui.app import WritingAssistantApp

def main():
    """主函数"""
    app = WritingAssistantApp()
    try:
        app.run()
    except KeyboardInterrupt:
        pass
    finally:
        app.cleanup()

if __name__ == "__main__":
    main()
