"""Coze AI 服务配置对话框。"""

import threading

from PySide6.QtCore import Signal
from PySide6.QtWidgets import (QCheckBox, QDialog, QHBoxLayout, QLabel,
                               QLineEdit, QMessageBox, QVBoxLayout)

from continuum.config.coze_config import CozeConfig
from continuum.core.coze_service import CozeService
from continuum.gui.components.buttons import styled_button
from continuum.gui.theme import ERROR_COLOR, PRIMARY_COLOR, BUTTON_HOVER_COLOR, SUCCESS_COLOR


class CozeConfigDialog(QDialog):
    """配置 Coze API 凭证，并异步校验有效性。"""

    _validated = Signal(bool)

    def __init__(self, coze_config: CozeConfig, coze_service: CozeService, parent=None):
        super().__init__(parent)
        self.coze_config = coze_config
        self.coze_service = coze_service

        self.setWindowTitle("Coze API配置")
        self.setFixedWidth(460)
        self.setModal(True)

        # 配置状态
        configured = coze_config.is_configured()
        status_row = QHBoxLayout()
        status_row.addWidget(QLabel("配置状态：", self))
        self.status_label = QLabel("已配置" if configured else "未配置", self)
        self.status_label.setStyleSheet(
            f"color: {SUCCESS_COLOR if configured else ERROR_COLOR}; font-weight: bold;"
        )
        status_row.addWidget(self.status_label)
        status_row.addStretch()

        # 令牌输入（默认掩码显示）
        self.token_edit = QLineEdit(coze_config.get("token", ""), self)
        self.token_edit.setEchoMode(QLineEdit.Password)
        self.token_edit.setPlaceholderText("请输入 Coze API 令牌")
        self.show_token_check = QCheckBox("显示令牌", self)
        self.show_token_check.toggled.connect(self._toggle_token_visibility)

        token_row = QHBoxLayout()
        token_row.addWidget(self.token_edit, stretch=1)
        token_row.addWidget(self.show_token_check)

        # 用户 ID 输入
        self.user_edit = QLineEdit(coze_config.get("user_id", ""), self)
        self.user_edit.setPlaceholderText("请输入用户 ID")

        # 保存按钮
        self.save_button = styled_button("保存配置", PRIMARY_COLOR, BUTTON_HOVER_COLOR)
        self.save_button.clicked.connect(self._validate_and_save)
        self._validated.connect(self._on_validated)

        layout = QVBoxLayout(self)
        layout.addLayout(status_row)
        layout.addWidget(QLabel("Coze API令牌：", self))
        layout.addLayout(token_row)
        layout.addWidget(QLabel("用户ID：", self))
        layout.addWidget(self.user_edit)
        layout.addWidget(self.save_button)

    def _toggle_token_visibility(self, visible: bool) -> None:
        self.token_edit.setEchoMode(QLineEdit.Normal if visible else QLineEdit.Password)

    def _validate_and_save(self) -> None:
        token = self.token_edit.text().strip()
        user_id = self.user_edit.text().strip()
        if not token or not user_id:
            QMessageBox.warning(self, "输入错误", "令牌和用户ID不能为空")
            return

        self.save_button.setEnabled(False)
        self.save_button.setText("验证中…")

        def worker():
            is_valid = self.coze_service.validate_config(token, user_id)
            self._validated.emit(is_valid)

        threading.Thread(target=worker, daemon=True).start()

    def _on_validated(self, is_valid: bool) -> None:
        self.save_button.setEnabled(True)
        self.save_button.setText("保存配置")
        if is_valid:
            self.coze_config.update_config(
                self.token_edit.text().strip(), self.user_edit.text().strip()
            )
            self.accept()
            QMessageBox.information(self, "保存成功", "Coze API配置已保存并验证通过")
        else:
            self.status_label.setText("配置无效")
            self.status_label.setStyleSheet(f"color: {ERROR_COLOR}; font-weight: bold;")
            QMessageBox.critical(self, "验证失败", "Coze API配置无效，请检查令牌和用户ID")
