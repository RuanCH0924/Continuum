"""continuum.utils.random_utils 随机中文生成器测试。"""

import unittest

from continuum.utils.random_utils import RandomChineseGenerator


class TestRandomChineseGenerator(unittest.TestCase):
    """随机中文生成与字数校验测试。"""

    def setUp(self):
        self.generator = RandomChineseGenerator()

    def test_generate_word_count(self):
        """生成文本的汉字数量应达到目标字数。"""
        target = 100
        text = self.generator.generate(target)
        # 汉字计数，标点与换行不计入
        chinese_chars = [c for c in text if "\u4e00" <= c <= "\u9fff"]
        self.assertGreaterEqual(len(chinese_chars), target)
        # 输出长度应在目标字数附近（含少量标点）
        self.assertLessEqual(len(text), target + 50)

    def test_validate_word_count_clamp(self):
        """字数校验应限制在 [min, max] 区间。"""
        v = RandomChineseGenerator.validate_word_count
        self.assertEqual(v(10, 1, 100, 50), 10)
        self.assertEqual(v(0, 1, 100, 50), 1)
        self.assertEqual(v(500, 1, 100, 50), 100)
        self.assertEqual(v("abc", 1, 100, 50), 50)


if __name__ == "__main__":
    unittest.main()
