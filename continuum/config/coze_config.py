import json
import os
from typing import Dict, Optional
import logging

logger = logging.getLogger(__name__)

class CozeConfig:
    """Coze API配置管理类"""
    
    def __init__(self, config_file: str = "coze_config.json"):
        """初始化配置管理器"""
        # 获取配置文件路径
        self.config_dir = os.path.join(os.path.dirname(__file__), "..", "..", "config")
        self.config_file = os.path.join(self.config_dir, config_file)
        
        # 确保配置目录存在
        if not os.path.exists(self.config_dir):
            os.makedirs(self.config_dir)
        
        # 默认配置
        self.default_config = {
            "token": "",
            "user_id": "",
            "bot_id": "7583233838541963314",
            "is_configured": False
        }
        
        # 加载配置
        self.config = self._load_config()
    
    def _load_config(self) -> Dict:
        """加载配置文件"""
        try:
            if os.path.exists(self.config_file):
                with open(self.config_file, "r", encoding="utf-8") as f:
                    config = json.load(f)
                logger.info("Coze配置加载成功")
                return {**self.default_config, **config}
            else:
                logger.info("Coze配置文件不存在，使用默认配置")
                return self.default_config.copy()
        except json.JSONDecodeError:
            logger.error("Coze配置文件格式错误，使用默认配置")
            return self.default_config.copy()
        except Exception as e:
            logger.error(f"加载Coze配置失败: {str(e)}")
            return self.default_config.copy()
    
    def save_config(self) -> bool:
        """保存配置到文件"""
        try:
            with open(self.config_file, "w", encoding="utf-8") as f:
                json.dump(self.config, f, indent=4, ensure_ascii=False)
            logger.info("Coze配置保存成功")
            return True
        except Exception as e:
            logger.error(f"保存Coze配置失败: {str(e)}")
            return False
    
    def get(self, key: str, default: Optional[any] = None) -> any:
        """获取配置项"""
        return self.config.get(key, default)
    
    def set(self, key: str, value: any):
        """设置配置项"""
        self.config[key] = value
    
    def update_config(self, token: str, user_id: str, bot_id: str = "7583233838541963314") -> bool:
        """更新完整配置"""
        self.config.update({
            "token": token,
            "user_id": user_id,
            "bot_id": bot_id,
            "is_configured": bool(token and user_id)
        })
        return self.save_config()
    
    def is_configured(self) -> bool:
        """检查配置是否已完成"""
        return self.config.get("is_configured", False) and bool(self.config.get("token")) and bool(self.config.get("user_id"))
    
    def reset_config(self) -> bool:
        """重置配置"""
        self.config = self.default_config.copy()
        return self.save_config()
