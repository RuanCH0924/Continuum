# 主题色配置 - 豆包浏览器风格
THEME_CONFIG = {
    'primary_color': '#007aff',      # 主色调：豆包蓝色
    'secondary_color': '#5ac8fa',    # 次要色调：浅蓝色
    'background_color': '#ffffff',   # 背景色：白色
    'background_gradient': '#f5f7fa',# 渐变背景色
    'text_color': '#333333',         # 主文本色：深灰
    'text_secondary_color': '#666666', # 次要文本色：中灰
    'text_light_color': '#999999',   # 浅色文本：浅灰
    'border_color': '#e0e0e0',        # 边框色：淡灰
    'button_hover_color': '#0056b3',  # 按钮悬停色：深蓝色
    'success_color': '#34c759',       # 成功色：绿色
    'warning_color': '#ff9500',       # 警告色：橙色
    'error_color': '#ff3b30',         # 错误色：红色
    'card_background': '#ffffff',     # 卡片背景色：白色
    'card_shadow': '0 1px 3px rgba(0,0,0,0.1)', # 卡片阴影
    'border_radius': 8,               # 边框圆角
    'font_family': 'Microsoft YaHei, Arial, sans-serif'  # 字体族
}

# 应用配置
APP_CONFIG = {
    'window_title': '续言 Continuum',
    'window_geometry': '500x800',  # 测试更大的窗口尺寸
    'target_window_title': '作家助手',
    'fast_mode_params': {
        'chars_per_pause': 200,
        'pause_duration': 0.5
    },
    'slow_mode_params': {
        'chars_per_pause': 100,
        'pause_duration': 5
    },
    'clipboard_check_interval': 1
}

# 热键配置
HOTKEY_CONFIG = {
    'start_transcription': '<ctrl>+g'
}

# 随机生成配置
RANDOM_GENERATION_CONFIG = {
    'min_words': 1,
    'max_words': 100000,
    'default_words': 20000,
    'chinese_start_unicode': 0x4e00,
    'chinese_end_unicode': 0x9fff
}

# 编辑器配置
EDITOR_CONFIG = {
    'default_theme': 'light',       # light | dark
    'default_mode': 'split',        # edit | split | preview
    'autosave_interval': 30,        # 草稿自动保存间隔（秒）
    'word_target': 0                # 每日目标字数（0 表示不启用）
}
