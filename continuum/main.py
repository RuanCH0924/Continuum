#!/usr/bin/env python3
"""续言 Continuum 主入口文件"""

import logging
import os
import sys

from PySide6.QtCore import Qt
from PySide6.QtWidgets import QApplication

# WebEngine 与 OpenGL 上下文共享要求（必须在 QApplication 创建前设置）
QApplication.setAttribute(Qt.AA_ShareOpenGLContexts)

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

from continuum.gui.app import MainWindow


def main():
    """主函数"""
    app = QApplication(sys.argv)
    window = MainWindow()
    window.show()
    try:
        sys.exit(app.exec())
    except KeyboardInterrupt:
        pass
    finally:
        window.cleanup()


if __name__ == "__main__":
    main()
