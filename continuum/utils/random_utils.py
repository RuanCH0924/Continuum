import random
from typing import List

class RandomChineseGenerator:
    """随机中文生成器"""
    
    def __init__(self, start_unicode: int = 0x4e00, end_unicode: int = 0x9fff):
        self.start_unicode = start_unicode
        self.end_unicode = end_unicode
        self.punctuation_marks = '，。！？；：'
    
    def generate(self, target_words: int) -> str:
        """生成指定字数的随机中文文本"""
        result = []
        char_count = 0
        
        while char_count < target_words:
            # 每10-30个字符添加一个标点符号
            if char_count > 0 and random.randint(1, 30) <= 2:
                punctuation = random.choice(self.punctuation_marks)
                result.append(punctuation)
                # 句号后添加换行
                if punctuation == '。':
                    result.append('\n')
            else:
                # 生成随机中文字符
                result.append(chr(random.randint(self.start_unicode, self.end_unicode)))
                char_count += 1
        
        return ''.join(result)
    
    @staticmethod
    def validate_word_count(word_count: int, min_words: int, max_words: int, default_words: int) -> int:
        """验证并修正字数"""
        try:
            target_words = int(word_count)
            if target_words < min_words:
                target_words = min_words
            elif target_words > max_words:
                target_words = max_words
        except ValueError:
            target_words = default_words
        
        return target_words
