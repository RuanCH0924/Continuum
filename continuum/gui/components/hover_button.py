import tkinter as tk

class HoverButton(tk.Button):
    """自定义悬停按钮组件 - 豆包浏览器风格"""
    
    def __init__(self, master=None, hover_color: str = None, active_fg: str = None, **kwargs):
        """初始化悬停按钮"""
        # 默认配置 - 豆包风格
        self.default_bg = kwargs.get("bg", "#007aff")
        self.default_fg = kwargs.get("fg", "#333333")
        
        # 设置悬停颜色
        self.hover_color = hover_color or self._get_darkened_color(self.default_bg)
        self.active_fg = active_fg or self._get_active_foreground(self.default_bg)
        
        # 保存默认状态
        self.default_background = self.default_bg
        self.default_foreground = self.default_fg
        
        # 初始化按钮
        super().__init__(master, **kwargs)
        
        # 保存原始状态
        self.original_background = self["background"]
        self.original_foreground = self["foreground"]
        
        # 绑定事件 - 豆包风格交互
        self.bind("<Enter>", self.on_enter)
        self.bind("<Leave>", self.on_leave)
        self.bind("<ButtonPress-1>", self.on_press)
        self.bind("<ButtonRelease-1>", self.on_release)
        
        # 设置初始样式
        self.config(cursor="hand2")
    
    def _get_darkened_color(self, color: str) -> str:
        """生成深色版本的颜色 - 豆包风格"""
        if not color.startswith("#") or len(color) != 7:
            return color
        
        # 将十六进制颜色转换为RGB
        r = int(color[1:3], 16)
        g = int(color[3:5], 16)
        b = int(color[5:7], 16)
        
        # 降低亮度（变暗20%）
        r = max(0, int(r * 0.8))
        g = max(0, int(g * 0.8))
        b = max(0, int(b * 0.8))
        
        # 转换回十六进制
        return f"#{r:02x}{g:02x}{b:02x}"
    
    def _get_active_foreground(self, bg_color: str) -> str:
        """根据背景色自动计算活跃状态下的前景色 - 豆包风格"""
        # 如果背景色是深色，返回白色；否则返回深灰色
        if bg_color in ["#007aff", "#5ac8fa", "#34c759", "#ff9500", "#ff3b30"] or bg_color.startswith("#00") or bg_color.startswith("#1"):
            return "white"
        return "#333333"
    
    def on_enter(self, event):
        """鼠标进入时的处理 - 豆包风格"""
        self.config(
            background=self.hover_color,
            foreground=self.active_fg
        )
    
    def on_leave(self, event):
        """鼠标离开时的处理 - 豆包风格"""
        self.config(
            background=self.original_background,
            foreground=self.original_foreground
        )
    
    def on_press(self, event):
        """鼠标按下时的处理 - 豆包风格"""
        # 进一步变暗，模拟按下效果
        pressed_color = self._get_darkened_color(self.hover_color)
        self.config(
            background=pressed_color,
            foreground=self.active_fg
        )
    
    def on_release(self, event):
        """鼠标释放时的处理 - 豆包风格"""
        self.config(
            background=self.hover_color,
            foreground=self.active_fg
        )
