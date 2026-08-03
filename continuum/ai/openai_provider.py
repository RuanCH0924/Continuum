"""OpenAI 兼容 Provider。

通过统一的 /chat/completions 协议接入 OpenAI、DeepSeek、硅基流动、Ollama 等
任意兼容服务。
"""

import json

import requests

from continuum.ai.base import ChatMessage, LLMProvider, ProviderConfig


class OpenAICompatibleProvider(LLMProvider):
    """OpenAI 兼容接口 Provider。"""

    def _endpoint(self) -> str:
        return self.config.base_url.rstrip("/") + "/chat/completions"

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.config.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(self, messages: list, stream: bool) -> dict:
        return {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "stream": stream,
            "temperature": self.config.temperature,
        }

    def chat_stream(self, messages, on_delta=None) -> str:
        """流式对话（SSE 增量解析）。"""
        if not self.config.api_key:
            raise RuntimeError("未配置 API Key，请先在「设置 → AI 服务」中配置")
        full = ""
        try:
            with requests.post(
                self._endpoint(),
                headers=self._headers(),
                json=self._payload(messages, stream=True),
                stream=True,
                timeout=120,
            ) as resp:
                if resp.status_code != 200:
                    raise RuntimeError(f"AI 请求失败（HTTP {resp.status_code}）：{resp.text[:200]}")
                for raw in resp.iter_lines(decode_unicode=True):
                    if not raw or not raw.startswith("data:"):
                        continue
                    data = raw[5:].strip()
                    if data == "[DONE]":
                        break
                    chunk = json.loads(data)
                    delta = chunk["choices"][0].get("delta", {}).get("content")
                    if delta:
                        full += delta
                        if on_delta:
                            on_delta(delta)
        except requests.exceptions.RequestException as exc:
            raise RuntimeError(f"AI 网络异常：{exc}")
        return full

    def validate(self) -> tuple:
        """校验配置有效性（发起一次最小请求）。"""
        try:
            resp = requests.post(
                self._endpoint(),
                headers=self._headers(),
                json=self._payload(
                    [ChatMessage(role="user", content="ping")], stream=False
                ),
                timeout=15,
            )
            if resp.status_code in (200, 400):
                return True, ""
            return False, f"HTTP {resp.status_code}：{resp.text[:200]}"
        except requests.exceptions.RequestException as exc:
            return False, str(exc)
