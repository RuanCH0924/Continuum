import pyperclip
import time
import threading
from typing import Callable, Optional

class ClipboardMonitor:
    """剪贴板监视器，用于监听剪贴板内容变化"""
    
    def __init__(self, check_interval: int = 1):
        self.check_interval = check_interval
        self.last_clipboard = ""
        self.is_running = False
        self.thread = None
        self.callback: Optional[Callable[[str], None]] = None
    
    def set_callback(self, callback: Callable[[str], None]):
        """设置剪贴板变化时的回调函数"""
        self.callback = callback
    
    def start(self):
        """启动剪贴板监听"""
        if not self.is_running:
            self.is_running = True
            self.thread = threading.Thread(target=self._monitor_clipboard, daemon=True)
            self.thread.start()
    
    def stop(self):
        """停止剪贴板监听"""
        self.is_running = False
        if self.thread:
            self.thread.join(timeout=1)
    
    def _monitor_clipboard(self):
        """监听剪贴板内容变化"""
        while self.is_running:
            try:
                clipboard_text = pyperclip.paste()
                if clipboard_text and clipboard_text != self.last_clipboard:
                    self.last_clipboard = clipboard_text
                    if self.callback:
                        self.callback(clipboard_text)
            except Exception:
                pass
            time.sleep(self.check_interval)
    
    @staticmethod
    def get_clipboard_content() -> str:
        """获取当前剪贴板内容"""
        return pyperclip.paste()
