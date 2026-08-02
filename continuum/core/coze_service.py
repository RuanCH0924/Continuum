import requests
import logging
from typing import Optional, Callable, Dict, Any

logger = logging.getLogger(__name__)

class CozeService:
    """Coze API服务类，用于处理与Coze API的通信"""
    
    def __init__(self):
        """初始化CozeService"""
        self.base_url = "https://api.coze.cn/v3"
        self.timeout = 30  # 默认超时时间30秒
        self.session = requests.Session()
        self.current_request = None
        
    def set_config(self, token: str, user_id: str):
        """设置Coze API配置"""
        self.token = token
        self.user_id = user_id
        
    def validate_config(self, token: str, user_id: str) -> bool:
        """验证配置有效性"""
        try:
            headers = {
                "Authorization": f"Bearer {token}",
                "Content-Type": "application/json",
                "X-User-ID": user_id
            }
            
            # 发送一个简单的POST请求来验证配置，使用最小化的请求体
            payload = {
                "bot_id": "7583233838541963314",
                "user_id": user_id,
                "query": "test",
                "stream": False
            }
            
            logger.info(f"开始验证Coze API配置，URL: {self.base_url}/chat")
            logger.info(f"请求头: {headers}")
            logger.info(f"请求体: {payload}")
            
            response = self.session.post(
                f"{self.base_url}/chat",
                headers=headers,
                json=payload,
                timeout=10
            )
            
            # 记录详细的响应信息，便于调试
            logger.info(f"配置验证响应状态码: {response.status_code}")
            logger.info(f"配置验证响应头: {dict(response.headers)}")
            logger.info(f"配置验证响应内容: {response.text}")
            
            # 解析响应内容
            try:
                response_data = response.json()
                logger.info(f"配置验证响应数据: {response_data}")
                
                # 检查响应是否包含错误信息
                if "code" in response_data:
                    logger.error(f"Coze API请求失败，错误代码: {response_data['code']}, 错误消息: {response_data['msg']}")
                    # 如果是token无效或权限问题，返回False
                    if response_data['code'] in [401, 403]:
                        return False
                    # 其他错误可能是参数问题，但token是有效的
                    return True
            except Exception as e:
                logger.error(f"解析配置验证响应失败: {str(e)}")
            
            # 200表示成功，400表示token有效但参数可能有问题，401表示token无效
            return response.status_code in [200, 400]
        except requests.exceptions.RequestException as e:
            logger.error(f"配置验证网络异常: {str(e)}")
            logger.error(f"异常类型: {type(e).__name__}")
            if hasattr(e, 'response') and e.response:
                logger.error(f"异常响应状态码: {e.response.status_code}")
                logger.error(f"异常响应内容: {e.response.text}")
            return False
        except Exception as e:
            logger.error(f"配置验证失败: {str(e)}")
            logger.error(f"异常类型: {type(e).__name__}")
            import traceback
            logger.error(f"异常堆栈: {traceback.format_exc()}")
            return False
    
    def enhance_text(self, text: str, bot_id: str = "7583233838541963314", 
                    on_progress: Optional[Callable] = None, 
                    on_error: Optional[Callable] = None) -> Optional[str]:
        """通过Coze API增强文本内容"""
        if not self.token or not self.user_id:
            logger.error("Coze API配置未设置")
            if on_error:
                on_error("Coze API配置未设置")
            return None
        
        try:
            headers = {
                "Authorization": f"Bearer {self.token}",
                "Content-Type": "application/json",
                "X-User-ID": self.user_id
            }
            
            # 使用用户提供的JSON格式设计请求体
            payload = {
                "bot_id": bot_id,
                "user_id": self.user_id,
                "stream": True,
                "additional_messages": [
                    {
                        "content": text,
                        "content_type": "text",
                        "role": "user",
                        "type": "question"
                    }
                ],
                "parameters": {},
                "auto_save_history": True
            }
            
            logger.info(f"正在请求Coze API增强文本，文本长度: {len(text)}字符")
            
            # 发送请求
            self.current_request = self.session.post(
                f"{self.base_url}/chat",
                headers=headers,
                json=payload,
                timeout=self.timeout,
                stream=True  # 启用流式响应
            )
            
            # 检查响应状态
            if self.current_request.status_code != 200:
                error_msg = f"Coze API请求失败，状态码: {self.current_request.status_code}"
                logger.error(error_msg)
                if on_error:
                    on_error(error_msg)
                return None
            
            logger.info("开始处理Coze API流式响应")
            
            # 处理流式响应
            enhanced_text = ""
            current_event = None
            
            try:
                # 逐行读取流式响应
                for line in self.current_request.iter_lines():
                    if not line:
                        continue
                    
                    # 解码行内容
                    line = line.decode('utf-8')
                    
                    # 记录每一行原始响应
                    logger.debug(f"原始流式响应行: {line}")
                    
                    # 检查是否需要取消请求
                    if not self.current_request:
                        logger.info("请求已取消，停止处理流式响应")
                        return None
                    
                    # 处理Coze API的事件流格式
                    import json
                    
                    # 处理事件类型行
                    if line.startswith('event:'):
                        current_event = line[6:].strip()
                        logger.info(f"当前事件类型: {current_event}")
                        continue
                    
                    # 处理数据行
                    if line.startswith('data:'):
                        data_str = line[5:].strip()
                        logger.info(f"事件数据: {data_str[:100]}...")
                        
                        # 检查是否流结束
                        if data_str == '[DONE]' or data_str == '"[DONE]"':
                            logger.info("事件流结束")
                            break
                        
                        try:
                            # 解析JSON数据
                            response_data = json.loads(data_str)
                            logger.debug(f"解析事件数据为JSON: {response_data}")
                            
                            # 检查响应数据中是否包含content字段
                            if isinstance(response_data, dict):
                                if "content" in response_data:
                                    content = response_data["content"]
                                    
                                    # 根据事件类型处理内容
                                    if current_event == "conversation.message.completed":
                                        # 如果是完成事件，直接使用完整内容
                                        enhanced_text = content
                                        logger.info(f"从完成事件获取完整回复: {enhanced_text[:100]}...")
                                        break
                                    elif current_event == "conversation.message.delta":
                                        # 如果是增量事件，累加内容
                                        enhanced_text += content
                                        logger.info(f"累加增量文本，当前长度: {len(enhanced_text)}")
                                    else:
                                        # 其他事件，直接使用内容
                                        enhanced_text = content
                                        logger.info(f"从事件获取文本: {enhanced_text[:50]}...")
                        except json.JSONDecodeError as e:
                            logger.warning(f"解析事件数据失败: {str(e)}")
                            continue
                    
                    logger.debug(f"当前累加文本长度: {len(enhanced_text)}")
                    if on_progress:
                        on_progress(enhanced_text)
            except json.JSONDecodeError as e:
                logger.error(f"解析流式响应失败: {str(e)}")
                if on_error:
                    on_error(f"解析流式响应失败: {str(e)}")
                return None
            except Exception as e:
                logger.error(f"处理流式响应失败: {str(e)}")
                if on_error:
                    on_error(f"处理流式响应失败: {str(e)}")
                return None
            finally:
                # 确保响应被关闭
                self.current_request.close()
                self.current_request = None
            
            # 检查是否获取到增强后的文本
            if enhanced_text:
                logger.info(f"Coze API增强文本成功，增强后文本长度: {len(enhanced_text)}字符")
                return enhanced_text
            else:
                logger.warning(f"未获取到增强后的文本，返回原始文本")
                return text
                
        except requests.exceptions.Timeout:
            error_msg = "Coze API请求超时"
            logger.error(error_msg)
            if on_error:
                on_error(error_msg)
            return None
        except requests.exceptions.RequestException as e:
            error_msg = f"Coze API请求异常: {str(e)}"
            logger.error(error_msg)
            if on_error:
                on_error(error_msg)
            return None
        except Exception as e:
            error_msg = f"Coze API处理异常: {str(e)}"
            logger.error(error_msg)
            if on_error:
                on_error(error_msg)
            return None
        finally:
            if self.current_request:
                try:
                    self.current_request.close()
                except:
                    pass
                self.current_request = None
    
    def cancel_request(self):
        """取消当前请求"""
        if self.current_request:
            logger.info("正在取消Coze API请求")
            # 检查current_request是否有cancel方法
            if hasattr(self.current_request, 'cancel'):
                self.current_request.cancel()
            # 重置current_request为None
            self.current_request = None
    
    def cleanup(self):
        """清理资源"""
        self.cancel_request()
        self.session.close()
