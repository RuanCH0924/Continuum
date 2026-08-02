from pynput import keyboard as pynput_keyboard
from typing import Callable, Dict, Any

class HotkeyService:
    """热键服务，用于注册和监听全局热键"""
    
    def __init__(self):
        self.hotkeys: Dict[str, Any] = {}
        self.listener = None
        self.is_listening = False
    
    def register_hotkey(self, hotkey_str: str, callback: Callable):
        """注册热键"""
        # 解析热键字符串
        hotkey = pynput_keyboard.HotKey(
            pynput_keyboard.HotKey.parse(hotkey_str),
            callback
        )
        self.hotkeys[hotkey_str] = hotkey
    
    def unregister_hotkey(self, hotkey_str: str):
        """注销热键"""
        if hotkey_str in self.hotkeys:
            del self.hotkeys[hotkey_str]
    
    def start_listening(self):
        """开始监听热键"""
        if not self.is_listening:
            self.is_listening = True
            
            def on_press(key):
                for hotkey in self.hotkeys.values():
                    hotkey.press(self.listener.canonical(key))
            
            def on_release(key):
                for hotkey in self.hotkeys.values():
                    hotkey.release(self.listener.canonical(key))
            
            self.listener = pynput_keyboard.Listener(
                on_press=on_press,
                on_release=on_release
            )
            self.listener.start()
    
    def stop_listening(self):
        """停止监听热键"""
        if self.is_listening and self.listener:
            self.is_listening = False
            self.listener.stop()
            self.listener.join(timeout=1)
    
    def is_running(self) -> bool:
        """检查热键监听是否正在运行"""
        return self.is_listening
