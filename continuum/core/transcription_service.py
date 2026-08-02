from pynput.keyboard import Controller
import time
import threading
import pygetwindow as gw
from typing import Callable, Optional

class TranscriptionService:
    """转写服务，负责将文本转换为键盘输入"""
    
    def __init__(self):
        self.keyboard = Controller()
        self.is_transcribing = False
        self.transcription_thread = None
        self.current_text = ""
    
    def start_transcription(self, text: str, target_window_title: str, 
                           fast_mode: bool, fast_mode_params: dict, 
                           slow_mode_params: dict, 
                           on_start: Optional[Callable] = None,
                           on_progress: Optional[Callable[[str], None]] = None,
                           on_completed: Optional[Callable] = None,
                           on_stopped: Optional[Callable] = None):
        """开始转写"""
        if self.is_transcribing:
            return False
        
        if not text:
            return False
        
        # 获取并激活目标窗口
        try:
            window = gw.getWindowsWithTitle(target_window_title)[0]
            window.activate()
        except IndexError:
            return False
        
        self.is_transcribing = True
        self.current_text = text
        
        if on_start:
            on_start()
        
        # 在新线程中执行转写
        self.transcription_thread = threading.Thread(
            target=self._perform_transcription,
            args=(text, fast_mode, fast_mode_params, slow_mode_params, 
                  on_progress, on_completed, on_stopped)
        )
        self.transcription_thread.daemon = True
        self.transcription_thread.start()
        
        return True
    
    def stop_transcription(self):
        """停止转写"""
        self.is_transcribing = False
    
    def is_running(self) -> bool:
        """检查转写是否正在进行"""
        return self.is_transcribing
    
    def _perform_transcription(self, text: str, fast_mode: bool, 
                              fast_mode_params: dict, slow_mode_params: dict,
                              on_progress: Optional[Callable[[str], None]] = None,
                              on_completed: Optional[Callable] = None,
                              on_stopped: Optional[Callable] = None):
        """执行转写操作"""
        try:
            # 根据模式选择参数
            if fast_mode:
                chars_per_pause = fast_mode_params['chars_per_pause']
                pause_duration = fast_mode_params['pause_duration']
            else:
                chars_per_pause = slow_mode_params['chars_per_pause']
                pause_duration = slow_mode_params['pause_duration']
            
            # 执行转写
            char_count = 0
            for char in text:
                if not self.is_transcribing:
                    if on_stopped:
                        on_stopped()
                    return
                
                self.keyboard.type(char)
                char_count += 1
                
                # 更新进度
                if on_progress and char_count % 50 == 0:
                    on_progress(text[:5] + "……" + text.replace(" ", "")[-5:])
                
                # 根据模式决定暂停
                if char_count % chars_per_pause == 0:
                    time.sleep(pause_duration)
            
            # 转写完成
            if self.is_transcribing:
                if on_completed:
                    on_completed()
        finally:
            self.is_transcribing = False
