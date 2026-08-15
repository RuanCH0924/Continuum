import React, { useEffect, useState } from 'react'
import { PROVIDER_PRESETS, presetByKey } from '../lib/ai/registry'
import { validateConfig } from '../lib/ai/openaiCompat'
import { useAiStore } from '../stores/aiStore'
import { FormatSettingsSection } from './FormatSettings'
import type { AIConfig } from '../lib/ai/types'

type SettingsTab = 'ai' | 'format'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'ai', label: 'AI 服务' },
  { key: 'format', label: '格式' }
]

/**
 * 设置中心（整合原设置菜单全部设置项）：AI 服务 + 格式。
 * 各设置项的交互、数据存储与生效方式与原独立弹窗完全一致。
 */
export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('ai')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="w-[520px] rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center border-b border-neutral-200 px-5 py-3">
          <span className="text-[14px] font-semibold text-neutral-900">设置</span>
          <span className="ml-2 text-[11px] text-neutral-500">本地保存 · 即时生效</span>
          <button className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Tab 切换 */}
        <div className="flex gap-1 px-5 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`rounded-md px-3 py-1.5 text-[12px] transition-colors duration-fast ${
                tab === t.key
                  ? 'bg-brand-50 font-medium text-brand-500'
                  : 'text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900'
              }`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'ai' ? <AiServiceSection onSaved={onClose} /> : <FormatSettingsSection onSaved={onClose} />}
      </div>
    </div>
  )
}

/** AI 服务设置表单（原「AI 服务设置」弹窗全部设置项与交互）。 */
function AiServiceSection({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const config = useAiStore((s) => s.config)
  const configLoaded = useAiStore((s) => s.configLoaded)
  const loadConfig = useAiStore((s) => s.loadConfig)
  const saveConfig = useAiStore((s) => s.saveConfig)

  const [form, setForm] = useState<AIConfig>(config)
  const [validating, setValidating] = useState(false)
  const [checkMsg, setCheckMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    void loadConfig()
  }, [loadConfig])

  useEffect(() => {
    if (configLoaded) setForm(config)
  }, [configLoaded, config])

  const pickProvider = (key: string): void => {
    const preset = presetByKey(key)
    if (preset) setForm((f) => ({ ...f, provider: preset.key, baseUrl: preset.baseUrl, model: preset.model }))
  }

  const handleValidate = async (): Promise<void> => {
    setValidating(true)
    setCheckMsg(null)
    const res = await validateConfig(form)
    setValidating(false)
    setCheckMsg(res.ok ? { ok: true, text: '连接成功，配置可用' } : { ok: false, text: res.error })
  }

  const handleSave = async (): Promise<void> => {
    setSaving(true)
    const ok = await saveConfig(form)
    setSaving(false)
    if (ok) onSaved()
    else setCheckMsg({ ok: false, text: '保存失败，请重试' })
  }

  return (
    <>
      <div className="space-y-3 px-5 py-4 text-[12px]">
        <label className="block">
          <span className="mb-1 block text-neutral-500">服务商</span>
          <select
            value={form.provider}
            onChange={(e) => pickProvider(e.target.value)}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
          >
            {PROVIDER_PRESETS.map((p) => (
              <option key={p.key} value={p.key}>
                {p.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block">
          <span className="mb-1 block text-neutral-500">API Key（本地保存，仅用于直连服务）</span>
          <input
            type="password"
            value={form.apiKey}
            onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
            placeholder={presetByKey(form.provider)?.needsKey ? 'sk-…' : '本地服务无需 Key'}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
          />
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1 block text-neutral-500">Base URL</span>
            <input
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-neutral-500">模型</span>
            <input
              value={form.model}
              onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
              className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
            />
          </label>
        </div>

        <label className="block">
          <span className="mb-1 block text-neutral-500">
            Embedding 模型（知识库语义检索；留空则仅关键词匹配）
          </span>
          <input
            value={form.embeddingModel ?? ''}
            onChange={(e) => setForm((f) => ({ ...f, embeddingModel: e.target.value }))}
            placeholder="如：bge-large-zh / text-embedding-ada-002"
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
          />
        </label>

        <label className="block">
          <span className="mb-1 flex justify-between text-neutral-500">
            <span>温度（随机性）</span>
            <span className="text-neutral-300">{form.temperature.toFixed(1)}</span>
          </span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.1}
            value={form.temperature}
            onChange={(e) => setForm((f) => ({ ...f, temperature: Number(e.target.value) }))}
            className="w-full accent-[var(--brand-500)]"
          />
        </label>

        {checkMsg && (
          <div
            className={`rounded-md border px-3 py-2 text-[12px] ${
              checkMsg.ok
                ? 'border-status-success/30 bg-status-success/10 text-status-success'
                : 'border-status-danger/30 bg-status-danger/10 text-status-danger'
            }`}
          >
            {checkMsg.text}
          </div>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
        <button className="btn-default" onClick={() => void handleValidate()} disabled={validating}>
          {validating ? '校验中…' : '校验连接'}
        </button>
        <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </>
  )
}
