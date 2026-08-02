import tkinter as tk
from tkinter import messagebox, ttk
import threading
from typing import Optional

# 导入内部模块
from continuum.config.settings import THEME_CONFIG, APP_CONFIG, HOTKEY_CONFIG, RANDOM_GENERATION_CONFIG
from continuum.config.coze_config import CozeConfig
from continuum.gui.components.hover_button import HoverButton
from continuum.core.transcription_service import TranscriptionService
from continuum.core.coze_service import CozeService
from continuum.utils.clipboard_utils import ClipboardMonitor
from continuum.utils.random_utils import RandomChineseGenerator
from continuum.core.hotkey_service import HotkeyService

class WritingAssistantApp:
    """续言 Continuum 主应用程序"""
    
    def __init__(self):
        # 初始化配置
        self.theme_config = THEME_CONFIG
        self.app_config = APP_CONFIG
        self.hotkey_config = HOTKEY_CONFIG
        self.random_gen_config = RANDOM_GENERATION_CONFIG
        self.coze_config = CozeConfig()
        
        # 初始化服务
        self.transcription_service = TranscriptionService()
        self.coze_service = CozeService()
        self.clipboard_monitor = ClipboardMonitor(check_interval=self.app_config['clipboard_check_interval'])
        self.random_generator = RandomChineseGenerator(
            start_unicode=self.random_gen_config['chinese_start_unicode'],
            end_unicode=self.random_gen_config['chinese_end_unicode']
        )
        self.hotkey_service = HotkeyService()
        
        # 初始化状态变量
        self.is_topmost = True
        self.fast_mode = True
        self.auto_paste_enabled = False
        self.is_enhancing = False
        
        # 初始化GUI
        self.root = None
        self.text_input = None
        self.log_text = None
        self.word_count_label = None
        self.word_num_var = None
        self.auto_paste_var = None
        self.start_button = None
        self.enhance_button = None
        self.mode_button = None
        self.toggle_button = None
        self.config_button = None
        self.config_window = None
        
        # 创建主窗口
        self.create_main_window()
        
        # 初始化Coze配置
        self._init_coze_config()
        
        # 初始化剪贴板监听
        self.clipboard_monitor.set_callback(self.update_textbox_from_clipboard)
        self.clipboard_monitor.start()
        
        # 初始化热键
        self.hotkey_service.register_hotkey(
            self.hotkey_config['start_transcription'],
            self.start_transcription
        )
        self.hotkey_service.start_listening()
    
    def _init_coze_config(self):
        """初始化Coze配置"""
        # 从配置文件加载Coze API配置
        token = self.coze_config.get("token")
        user_id = self.coze_config.get("user_id")
        if token and user_id:
            self.coze_service.set_config(token, user_id)
            self.add_log("Coze API配置已加载")
        else:
            self.add_log("Coze API配置未设置，请先配置")
    
    def create_main_window(self):
        """创建主窗口"""
        # 创建主窗口
        self.root = tk.Tk()
        self.root.title(self.app_config['window_title'])
        self.root.geometry(self.app_config['window_geometry'])
        self.root.configure(bg=self.theme_config['background_color'])
        self.root.attributes("-topmost", self.is_topmost)
        
        # 设置样式
        self._setup_styles()
        
        # 创建主框架
        main_frame = tk.Frame(self.root, bg=self.theme_config['background_color'])
        main_frame.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
        
        # 创建文本输入区域
        self._create_text_input_area(main_frame)
        
        # 创建顶部控制区域
        self._create_top_control_area(main_frame)
        
        # 创建随机生成区域
        self._create_random_generation_area(main_frame)
        
        # 创建日志区域
        self._create_log_area(main_frame)
        
        # 创建按钮区域
        self._create_button_area(main_frame)
    
    def _setup_styles(self):
        """设置ttk样式"""
        style = ttk.Style()
        style.configure("TButton",
                       padding=(10, 5),
                       font=('微软雅黑', 10),
                       background=self.theme_config['primary_color'],
                       foreground=self.theme_config['text_color'])
        style.configure("TLabel",
                       font=('微软雅黑', 10),
                       background=self.theme_config['background_color'],
                       foreground=self.theme_config['text_color'])
        style.configure("TCheckbutton",
                       font=('微软雅黑', 10),
                       background=self.theme_config['background_color'])
    
    def _create_text_input_area(self, parent):
        """创建文本输入区域"""
        input_frame = tk.LabelFrame(parent, text="输入文本", 
                                  bg=self.theme_config['background_color'], 
                                  font=('微软雅黑', 10))
        input_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        input_scrollbar = tk.Scrollbar(input_frame, orient=tk.VERTICAL)
        self.text_input = tk.Text(input_frame, height=15, width=70, 
                                 font=('微软雅黑', 10),
                                 yscrollcommand=input_scrollbar.set, 
                                 wrap=tk.WORD, bd=1, relief=tk.SUNKEN)
        input_scrollbar.config(command=self.text_input.yview)
        input_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.text_input.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
        
        # 绑定文本变化事件
        self.text_input.bind("<KeyRelease>", self.update_word_count)
    
    def _create_top_control_area(self, parent):
        """创建顶部控制区域"""
        top_control_frame = tk.Frame(parent, bg=self.theme_config['background_color'])
        top_control_frame.pack(fill=tk.X, pady=5)
        
        # 自动加载剪贴板复选框
        self.auto_paste_var = tk.BooleanVar()
        auto_paste_check = tk.Checkbutton(top_control_frame, 
                                         text="自动加载剪贴板内容", 
                                         variable=self.auto_paste_var,
                                         bg=self.theme_config['background_color'], 
                                         font=('微软雅黑', 10))
        auto_paste_check.pack(side=tk.LEFT, padx=5)
        
        # 字数显示标签
        self.word_count_label = tk.Label(top_control_frame, 
                                        text="字数：0",
                                        bg=self.theme_config['background_color'], 
                                        font=('微软雅黑', 10, 'bold'))
        self.word_count_label.pack(side=tk.LEFT, padx=20)
    
    def _create_random_generation_area(self, parent):
        """创建随机生成区域"""
        word_num_frame = tk.Frame(parent, bg=self.theme_config['background_color'])
        word_num_frame.pack(fill=tk.X, pady=5)
        
        # 字数标签
        word_num_label = tk.Label(word_num_frame, 
                                 text="随机生成字数：", 
                                 bg=self.theme_config['background_color'], 
                                 font=('微软雅黑', 10))
        word_num_label.pack(side=tk.LEFT, padx=5)
        
        # 字数输入框
        self.word_num_var = tk.StringVar(value=str(self.random_gen_config['default_words']))
        word_num_entry = tk.Entry(word_num_frame, 
                                 textvariable=self.word_num_var, 
                                 width=10, 
                                 font=('微软雅黑', 10), 
                                 bd=1, relief=tk.SUNKEN, justify=tk.CENTER)
        word_num_entry.pack(side=tk.LEFT, padx=5)
        
        # 随机生成按钮
        generate_button = HoverButton(
            word_num_frame, 
            text="随机生成", 
            command=self.generate_random_chinese,
            bg=self.theme_config['primary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10, 'bold'),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            hover_color=self.theme_config['button_hover_color']
        )
        generate_button.pack(side=tk.LEFT, padx=5)
    
    def _create_log_area(self, parent):
        """创建日志区域"""
        log_frame = tk.LabelFrame(parent, text="操作日志", 
                                 bg=self.theme_config['background_color'], 
                                 font=('微软雅黑', 10))
        log_frame.pack(fill=tk.BOTH, expand=True, pady=5)
        
        log_scrollbar = tk.Scrollbar(log_frame, orient=tk.VERTICAL)
        self.log_text = tk.Text(log_frame, height=8, width=70, 
                              font=('微软雅黑', 9),
                              yscrollcommand=log_scrollbar.set, 
                              wrap=tk.WORD, bd=1, relief=tk.SUNKEN)
        log_scrollbar.config(command=self.log_text.yview)
        log_scrollbar.pack(side=tk.RIGHT, fill=tk.Y)
        self.log_text.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    
    def _create_button_area(self, parent):
        """创建按钮区域"""
        button_frame = tk.Frame(parent, bg=self.theme_config['background_color'])
        button_frame.pack(fill=tk.X, pady=10)
        
        # 开始转写按钮
        self.start_button = HoverButton(
            button_frame, 
            text="开始转写", 
            command=self.start_transcription,
            bg=self.theme_config['secondary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10, 'bold'),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            width=12,
            hover_color=self.theme_config['button_hover_color']
        )
        self.start_button.grid(row=0, column=0, padx=10)
        
        # 润色转写按钮
        self.enhance_button = HoverButton(
            button_frame, 
            text="润色转写", 
            command=self.start_enhance_transcription,
            bg="#e67e22", 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10, 'bold'),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            width=12,
            hover_color="#d35400"
        )
        self.enhance_button.grid(row=0, column=1, padx=10)
        
        # 切换打字模式按钮
        self.mode_button = HoverButton(
            button_frame, 
            text="当前：快速模式(200/0.5)", 
            command=self.toggle_typing_mode,
            bg=self.theme_config['primary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            hover_color=self.theme_config['button_hover_color']
        )
        self.mode_button.grid(row=1, column=0, padx=10, pady=10)
        
        # 切换窗口置顶按钮
        self.toggle_button = HoverButton(
            button_frame, 
            text="取消置顶", 
            command=self.toggle_topmost,
            bg=self.theme_config['primary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            width=10,
            hover_color=self.theme_config['button_hover_color']
        )
        self.toggle_button.grid(row=1, column=1, padx=10, pady=10)
        
        # 配置按钮
        self.config_button = HoverButton(
            button_frame, 
            text="Coze配置", 
            command=self.open_coze_config_window,
            bg=self.theme_config['primary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            width=10,
            hover_color=self.theme_config['button_hover_color']
        )
        self.config_button.grid(row=1, column=2, padx=10, pady=10)
        
        # 居中按钮
        button_frame.grid_columnconfigure(0, weight=1)
        button_frame.grid_columnconfigure(1, weight=1)
        button_frame.grid_columnconfigure(2, weight=1)
    
    def update_textbox_from_clipboard(self, text: str):
        """从剪贴板更新文本框"""
        if self.auto_paste_var.get() and text and text != self.text_input.get("1.0", tk.END).strip():
            self.root.after(0, lambda: self._do_update_textbox(text))
    
    def _do_update_textbox(self, text: str):
        """更新文本框内容"""
        # 处理文本：删除空格和空白行
        processed_text = self._process_text(text)
        self.text_input.delete('1.0', tk.END)
        self.text_input.insert(tk.END, processed_text)
        self.update_word_count()
    
    def _process_text(self, text: str) -> str:
        """处理文本：删除空格和空白行"""
        # 按行分割文本
        lines = text.split('\n')
        # 处理每一行：删除行首尾空格，并过滤掉空行
        processed_lines = [line.strip() for line in lines if line.strip()]
        # 合并处理后的行，每行之间用换行符连接
        return '\n'.join(processed_lines)
    
    def generate_random_chinese(self):
        """生成随机中文内容"""
        # 获取并验证字数
        try:
            word_count = self.word_num_var.get()
            target_words = self.random_generator.validate_word_count(
                word_count,
                self.random_gen_config['min_words'],
                self.random_gen_config['max_words'],
                self.random_gen_config['default_words']
            )
            # 更新输入框中的字数
            self.word_num_var.set(str(target_words))
        except ValueError:
            messagebox.showwarning("输入错误", "请输入有效的整数字数，已使用默认值20000")
            target_words = self.random_gen_config['default_words']
            self.word_num_var.set(str(target_words))
        
        # 清空文本框
        self.text_input.delete('1.0', tk.END)
        
        # 显示生成中提示
        self.add_log(f"正在生成{target_words}字随机中文内容...")
        
        # 生成随机中文
        random_text = self.random_generator.generate(target_words)
        
        # 将生成的文本插入到文本框
        self.text_input.insert(tk.END, random_text)
        
        # 更新字数统计
        self.update_word_count()
        
        # 记录生成完成
        self.add_log(f"{target_words}字随机内容生成完成")
    
    def start_transcription(self):
        """开始转写"""
        if not self.transcription_service.is_running():
            text = self.text_input.get("1.0", tk.END).strip()
            if not text:
                messagebox.showwarning("警告", "请输入要转写的文本！")
                return
            
            # 切换按钮状态
            self._toggle_start_button(True)
            
            # 请求用户点击要输入的位置
            self.add_log("请点击要输入的位置")
            
            # 延迟后开始转写
            def delayed_start():
                self.transcription_service.start_transcription(
                    text=text,
                    target_window_title=self.app_config['target_window_title'],
                    fast_mode=self.fast_mode,
                    fast_mode_params=self.app_config['fast_mode_params'],
                    slow_mode_params=self.app_config['slow_mode_params'],
                    on_completed=self._transcription_completed,
                    on_stopped=self._transcription_stopped
                )
            
            threading.Thread(target=self._delay_start, args=(2, delayed_start), daemon=True).start()
        else:
            self.stop_transcription()
    
    def _delay_start(self, delay: float, callback):
        """延迟执行回调函数"""
        import time
        time.sleep(delay)
        self.root.after(0, callback)
    
    def stop_transcription(self):
        """停止转写"""
        self.transcription_service.stop_transcription()
        self.add_log("正在停止转写...")
    
    def _toggle_start_button(self, is_running: bool):
        """切换开始/停止按钮状态"""
        if is_running:
            self.start_button.config(text="停止转写", bg="#e74c3c")
        else:
            self.start_button.config(text="开始转写", command=self.start_transcription, bg=self.theme_config['secondary_color'])
    
    def _transcription_completed(self):
        """转写完成处理"""
        text = self.text_input.get("1.0", tk.END).strip()
        self.add_log(f'"{text[:5]}"……"{text.replace(" ", "")[-5:]}"  转写完成')
        self.root.after(0, lambda: self.text_input.delete('1.0', tk.END))
        self.root.after(0, lambda: self._toggle_start_button(False))
        self.root.after(0, lambda: self.update_word_count())
    
    def _transcription_stopped(self):
        """转写停止处理"""
        self.add_log("转写已停止")
        self.root.after(0, lambda: self._toggle_start_button(False))
    
    def toggle_typing_mode(self):
        """切换打字模式"""
        self.fast_mode = not self.fast_mode
        
        # 更新按钮文本以反映当前模式
        if self.fast_mode:
            self.mode_button.config(text="当前：快速模式(200/0.5)")
            self.add_log("已切换到快速模式：每打200字暂停0.5秒")
        else:
            self.mode_button.config(text="当前：慢速模式(100/5)")
            self.add_log("已切换到慢速模式：每打100字暂停5秒")
    
    def toggle_topmost(self):
        """切换窗口置顶状态"""
        self.is_topmost = not self.is_topmost
        self.root.attributes("-topmost", self.is_topmost)
        if self.is_topmost:
            self.toggle_button.config(text="取消置顶")
        else:
            self.toggle_button.config(text="置顶窗口")
    
    def update_word_count(self, event=None):
        """更新字数统计"""
        # 检查并加载剪贴板内容
        if self.auto_paste_var.get():
            try:
                import pyperclip
                clipboard_text = pyperclip.paste()
                if clipboard_text and not self.text_input.get("1.0", tk.END).strip():
                    self.text_input.insert(tk.END, clipboard_text)
            except ImportError:
                pass
        
        # 处理文本：删除空格和空白行
        current_text = self.text_input.get("1.0", tk.END)
        processed_text = self._process_text(current_text)
        
        # 如果文本有变化，更新文本框内容
        if current_text != processed_text:
            # 解绑事件，避免循环触发
            self.text_input.unbind("<KeyRelease>")
            # 更新文本框
            self.text_input.delete('1.0', tk.END)
            self.text_input.insert(tk.END, processed_text)
            # 重新绑定事件
            self.text_input.bind("<KeyRelease>", self.update_word_count)
        
        # 计算字数
        text = self.text_input.get("1.0", tk.END)
        word_count = len(text.rstrip().replace(" ", "").replace("\n", ""))
        self.word_count_label.config(text=f"字数：{word_count}")
    
    def add_log(self, message: str):
        """添加日志"""
        self.root.after(0, lambda: self._do_add_log(message))
    
    def _do_add_log(self, message: str):
        """添加日志到文本框"""
        self.log_text.insert(tk.END, f"{message}\n")
        self.log_text.see(tk.END)
    
    def run(self):
        """运行应用程序"""
        self.root.mainloop()
    
    def open_coze_config_window(self):
        """打开Coze API配置窗口"""
        # 如果配置窗口已存在，先关闭
        if hasattr(self, 'config_window') and self.config_window:
            self.config_window.destroy()
        
        # 创建配置窗口
        self.config_window = tk.Toplevel(self.root)
        self.config_window.title("Coze API配置")
        self.config_window.geometry("450x350")
        self.config_window.configure(bg=self.theme_config['background_color'])
        self.config_window.attributes("-topmost", True)
        
        # 配置状态变量
        self.config_status_var = tk.StringVar(value="未配置")
        self.config_status_color = tk.StringVar(value="red")
        
        # 检查当前配置状态
        if self.coze_config.is_configured():
            self.config_status_var.set("已配置")
            self.config_status_color.set("green")
        
        # 创建主框架
        config_frame = tk.Frame(self.config_window, bg=self.theme_config['background_color'])
        config_frame.pack(fill=tk.BOTH, expand=True, padx=20, pady=20)
        
        # 配置状态指示器
        status_frame = tk.Frame(config_frame, bg=self.theme_config['background_color'])
        status_frame.pack(fill=tk.X, pady=10)
        
        status_label = tk.Label(status_frame, text="配置状态：", 
                              bg=self.theme_config['background_color'], 
                              font=('微软雅黑', 10))
        status_label.pack(side=tk.LEFT)
        
        status_value = tk.Label(status_frame, textvariable=self.config_status_var, 
                              bg=self.theme_config['background_color'], 
                              fg=self.config_status_color.get(),
                              font=('微软雅黑', 10, 'bold'))
        status_value.pack(side=tk.LEFT)
        
        # 令牌输入框
        token_frame = tk.Frame(config_frame, bg=self.theme_config['background_color'])
        token_frame.pack(fill=tk.X, pady=10)
        
        token_label = tk.Label(token_frame, text="Coze API令牌：", 
                             bg=self.theme_config['background_color'], 
                             font=('微软雅黑', 10))
        token_label.pack(side=tk.TOP, anchor=tk.W)
        
        self.token_var = tk.StringVar(value=self.coze_config.get("token"))
        self.token_entry = tk.Entry(token_frame, textvariable=self.token_var, 
                                  font=('微软雅黑', 10), 
                                  bd=1, relief=tk.SUNKEN, show="*")
        self.token_entry.pack(fill=tk.X, pady=5)
        
        # 显示/隐藏密码按钮
        self.show_token_var = tk.BooleanVar()
        show_token_check = tk.Checkbutton(token_frame, text="显示令牌", 
                                        variable=self.show_token_var, 
                                        bg=self.theme_config['background_color'], 
                                        font=('微软雅黑', 9),
                                        command=self.toggle_token_visibility)
        show_token_check.pack(side=tk.RIGHT)
        
        # 用户ID输入框
        user_id_frame = tk.Frame(config_frame, bg=self.theme_config['background_color'])
        user_id_frame.pack(fill=tk.X, pady=10)
        
        user_id_label = tk.Label(user_id_frame, text="用户ID：", 
                               bg=self.theme_config['background_color'], 
                               font=('微软雅黑', 10))
        user_id_label.pack(side=tk.TOP, anchor=tk.W)
        
        self.user_id_var = tk.StringVar(value=self.coze_config.get("user_id"))
        user_id_entry = tk.Entry(user_id_frame, textvariable=self.user_id_var, 
                               font=('微软雅黑', 10), 
                               bd=1, relief=tk.SUNKEN)
        user_id_entry.pack(fill=tk.X, pady=5)
        
        # 保存按钮
        save_button = HoverButton(
            config_frame, 
            text="保存配置", 
            command=self.save_coze_config,
            bg=self.theme_config['primary_color'], 
            fg=self.theme_config['text_color'], 
            font=('微软雅黑', 10, 'bold'),
            relief=tk.RAISED, 
            bd=1, 
            cursor="hand2",
            hover_color=self.theme_config['button_hover_color']
        )
        save_button.pack(fill=tk.X, pady=20)
    
    def toggle_token_visibility(self):
        """切换令牌显示/隐藏状态"""
        if self.show_token_var.get():
            self.token_entry.config(show="")
        else:
            self.token_entry.config(show="*")
    
    def save_coze_config(self):
        """保存Coze API配置"""
        # 获取配置值
        token = self.token_var.get().strip()
        user_id = self.user_id_var.get().strip()
        
        # 验证输入
        if not token or not user_id:
            messagebox.showwarning("输入错误", "令牌和用户ID不能为空")
            return
        
        # 验证配置有效性
        self.add_log("正在验证Coze API配置...")
        
        # 异步验证配置
        def validate_and_save():
            is_valid = self.coze_service.validate_config(token, user_id)
            
            if is_valid:
                # 保存配置
                if self.coze_config.update_config(token, user_id):
                    self.coze_service.set_config(token, user_id)
                    self.config_status_var.set("已配置")
                    self.config_status_color.set("green")
                    self.config_window.destroy()
                    self.add_log("Coze API配置保存成功")
                    messagebox.showinfo("保存成功", "Coze API配置已保存并验证通过")
                else:
                    self.add_log("Coze API配置保存失败")
                    messagebox.showerror("保存失败", "配置保存失败，请检查权限")
            else:
                self.config_status_var.set("配置无效")
                self.config_status_color.set("red")
                self.add_log("Coze API配置验证失败")
                messagebox.showerror("验证失败", "Coze API配置无效，请检查令牌和用户ID")
        
        threading.Thread(target=validate_and_save, daemon=True).start()
    
    def start_enhance_transcription(self):
        """开始润色转写"""
        # 检查配置是否已设置
        if not self.coze_config.is_configured():
            messagebox.showwarning("配置未设置", "请先配置Coze API")
            return
        
        # 获取文本内容
        text = self.text_input.get("1.0", tk.END).strip()
        if not text:
            messagebox.showwarning("警告", "请输入要润色的文本！")
            return
        
        # 切换按钮状态
        self._toggle_enhance_button(True)
        
        # 添加日志
        self.add_log("正在润色文本，请稍候...")
        
        # 异步执行润色转写
        def enhance_and_transcribe():
            # 调用Coze API润色文本
            enhanced_text = self.coze_service.enhance_text(
                text,
                on_error=lambda msg: self._enhance_error(msg)
            )
            
            if enhanced_text:
                self.add_log(f"文本润色完成，润色后长度: {len(enhanced_text)}字符")
                
                # 使用与"开始转写"完全一致的转写机制
                self.transcription_service.start_transcription(
                    text=enhanced_text,
                    target_window_title=self.app_config['target_window_title'],
                    fast_mode=self.fast_mode,
                    fast_mode_params=self.app_config['fast_mode_params'],
                    slow_mode_params=self.app_config['slow_mode_params'],
                    on_completed=self._enhance_transcription_completed,
                    on_stopped=self._enhance_transcription_stopped
                )
            else:
                self._toggle_enhance_button(False)
        
        threading.Thread(target=enhance_and_transcribe, daemon=True).start()
    
    def _toggle_enhance_button(self, is_running: bool):
        """切换润色转写按钮状态"""
        if is_running:
            self.enhance_button.config(text="取消润色", bg="#e74c3c", command=self._cancel_enhance)
        else:
            self.enhance_button.config(text="润色转写", command=self.start_enhance_transcription, bg="#e67e22")
    
    def _cancel_enhance(self):
        """取消润色请求"""
        self.coze_service.cancel_request()
        self.add_log("正在取消润色请求...")
        self._toggle_enhance_button(False)
    
    def _enhance_error(self, error_msg: str):
        """润色错误处理"""
        self.root.after(0, lambda: messagebox.showerror("润色失败", error_msg))
        self.root.after(0, lambda: self.add_log(f"润色失败: {error_msg}"))
        self.root.after(0, lambda: self._toggle_enhance_button(False))
    
    def _enhance_transcription_completed(self):
        """润色转写完成处理"""
        text = self.text_input.get("1.0", tk.END).strip()
        self.add_log(f'"{text[:5]}"……"{text.replace(" ", "")[-5:]}"  润色转写完成')
        self.root.after(0, lambda: self.text_input.delete('1.0', tk.END))
        self.root.after(0, lambda: self.update_word_count())
        self.root.after(0, lambda: self._toggle_enhance_button(False))
    
    def _enhance_transcription_stopped(self):
        """润色转写停止处理"""
        self.add_log("润色转写已停止")
        self.root.after(0, lambda: self._toggle_enhance_button(False))
    
    def cleanup(self):
        """清理资源"""
        self.clipboard_monitor.stop()
        self.hotkey_service.stop_listening()
        self.coze_service.cleanup()
