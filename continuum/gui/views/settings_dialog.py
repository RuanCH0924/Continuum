"""AI 服务设置对话框（统一 AI 适配层配置）。"""

import threading

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (QComboBox, QDialog, QDoubleSpinBox, QFormLayout,
                               QHBoxLayout, QLabel, QLineEdit, QMessageBox,
                               QVBoxLayout)

from continuum.ai.registry import ProviderRegistry
from continuum.gui.components.buttons import styled_button


class AISettingsDialog(QDialog):
    """配置 OpenAI 兼容接口（api_key / base_url / model）。"""

    _validated = Signal(bool, str)

    def __init__(self, registry: ProviderRegistry, parent=None):
        super().__init__(parent)
        self.registry = registry
        self.setWindowTitle("AI 服务设置")
        self.setFixedWidth(480)
        cfg = registry.config

        self.provider_combo = QComboBox(self)
        self.provider_combo.addItem("OpenAI 兼容接口", "openai-compatible")

        self.api_key_edit = QLineEdit(cfg.api_key, self)
        self.api_key_edit.setEchoMode(QLineEdit.Password)
        self.api_key_edit.setPlaceholderText("sk-...")

        self.base_url_edit = QLineEdit(cfg.base_url, self)
        self.model_edit = QLineEdit(cfg.model, self)

        self.temperature_spin = QDoubleSpinBox(self)
        self.temperature_spin.setRange(0.0, 2.0)
        self.temperature_spin.setSingleStep(0.1)
        self.temperature_spin.setValue(cfg.temperature)

        form = QFormLayout()
        form.addRow("Provider", self.provider_combo)
        form.addRow("API Key", self.api_key_edit)
        form.addRow("Base URL", self.base_url_edit)
        form.addRow("模型", self.model_edit)
        form.addRow("温度", self.temperature_spin)

        hint = QLabel("支持任意 OpenAI 兼容接口：OpenAI / DeepSeek / 硅基流动 / Ollama 等", self)
        hint.setStyleSheet("color: #888888; font-size: 12px;")

        self.test_button = styled_button("测试连接", "#6f42c1", "#5a32a3")
        self.save_button = styled_button("保存", "#007aff", "#0056b3")
        row = QHBoxLayout()
        row.addWidget(self.test_button)
        row.addWidget(self.save_button)
        row.addStretch()

        layout = QVBoxLayout(self)
        layout.addLayout(form)
        layout.addWidget(hint)
        layout.addLayout(row)

        self.test_button.clicked.connect(self._test_connection)
        self.save_button.clicked.connect(self._save)
        self._validated.connect(self._on_validated)

    def _apply_fields(self):
        self.registry.update(
            provider=self.provider_combo.currentData(),
            api_key=self.api_key_edit.text().strip(),
            base_url=self.base_url_edit.text().strip(),
            model=self.model_edit.text().strip(),
            temperature=self.temperature_spin.value(),
        )

    def _test_connection(self):
        self._apply_fields()
        self.test_button.setEnabled(False)
        self.test_button.setText("测试中…")

        def worker():
            ok, error = self.registry.create_provider().validate()
            self._validated.emit(ok, error)

        threading.Thread(target=worker, daemon=True).start()

    def _on_validated(self, ok: bool, error: str):
        self.test_button.setEnabled(True)
        self.test_button.setText("测试连接")
        if ok:
            QMessageBox.information(self, "连接测试", "连接成功")
        else:
            QMessageBox.critical(self, "连接测试", f"连接失败：{error}")

    def _save(self):
        self._apply_fields()
        self.accept()
        QMessageBox.information(self, "保存成功", "AI 服务配置已保存")
