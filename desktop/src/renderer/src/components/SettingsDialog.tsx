import React, { useEffect, useState } from 'react'
import { PROVIDER_PRESETS, presetByKey } from '../lib/ai/registry'
import { validateConfig } from '../lib/ai/openaiCompat'
import { useAiStore } from '../stores/aiStore'
import { useAppStore } from '../stores/appStore'
import { FormatSettingsSection } from './FormatSettings'
import { AboutSection } from './AboutSettings'
import type { AIConfig } from '../lib/ai/types'

type SettingsTab = 'ai' | 'format' | 'goal' | 'about'

const TABS: { key: SettingsTab; label: string }[] = [
  { key: 'ai', label: 'AI 服务' },
  { key: 'format', label: '格式' },
  { key: 'goal', label: '写作目标' },
  { key: 'about', label: '关于' }
]

/**
 * 设置中心（左右分栏布局）：
 * - 左侧固定侧边栏：分类切换（AI 服务 / 格式…），集中展示、单击切换。
 * - 右侧内容区：当前选中分类的设置表单。
 * 各设置项的交互、数据存储与生效方式与原独立弹窗完全一致。
 */
export function SettingsDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const [tab, setTab] = useState<SettingsTab>('ai')

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onMouseDown={onClose}>
      <div
        className="flex h-[min(560px,80vh)] w-[min(640px,calc(100vw-32px))] overflow-hidden rounded-lg border border-neutral-200 bg-neutral-0 shadow-3"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* 左侧：分类侧边栏 */}
        <aside className="flex w-[160px] shrink-0 flex-col border-r border-neutral-200 bg-neutral-50">
          <div className="flex items-center px-4 py-3">
            <span className="text-[14px] font-semibold text-neutral-900">设置</span>
            <span className="ml-2 text-[11px] text-neutral-500">本地</span>
          </div>
          <nav className="flex flex-1 flex-col gap-0.5 px-2 pb-3">
            {TABS.map((t) => (
              <button
                key={t.key}
                className={`block w-full rounded-md px-3 py-2 text-left text-[12px] transition-colors duration-fast ${
                  tab === t.key
                    ? 'bg-brand-50 font-medium text-brand-500'
                    : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
                onClick={() => setTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </nav>
        </aside>

        {/* 右侧：内容区 */}
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center border-b border-neutral-200 px-5 py-3">
            <span className="text-[13px] font-medium text-neutral-900">
              {TABS.find((t) => t.key === tab)?.label}
            </span>
            <span className="ml-2 text-[11px] text-neutral-500">
              {tab === 'about' ? '版本与更新信息' : '本地保存 · 即时生效'}
            </span>
            <button
              className="ml-auto rounded p-1 text-neutral-500 hover:bg-neutral-100"
              onClick={onClose}
              title="关闭（Esc）"
            >
              ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            {tab === 'ai' && <AiServiceSection onSaved={onClose} />}
            {tab === 'format' && <FormatSettingsSection onSaved={onClose} />}
            {tab === 'goal' && <GoalSection onSaved={onClose} />}
            {tab === 'about' && <AboutSection />}
          </div>
        </section>
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

/** 写作目标设置：每日字数目标 + 今日写作字数指标看板 + 作品字数统计。 */
function GoalSection({ onSaved }: { onSaved: () => void }): React.JSX.Element {
  const dailyGoal = useAppStore((s) => s.dailyGoal)
  const todayChars = useAppStore((s) => s.todayChars)
  const charCount = useAppStore((s) => s.charCount)
  const workChars = useAppStore((s) => s.workChars)
  const totalChars = useAppStore((s) => s.totalChars)
  const setDailyGoal = useAppStore((s) => s.setDailyGoal)
  const [goal, setGoal] = useState(dailyGoal)
  const [saving, setSaving] = useState(false)

  // 进入页面时刷新最新统计，并保持输入与已保存目标同步
  useEffect(() => {
    void useAppStore.getState().loadStats()
    void useAppStore.getState().refreshWordTotals()
  }, [])
  useEffect(() => {
    setGoal(dailyGoal)
  }, [dailyGoal])

  const pct = dailyGoal > 0 ? Math.min(100, Math.round((todayChars / dailyGoal) * 100)) : 0
  const reached = pct >= 100
  const remain = Math.max(0, dailyGoal - todayChars)

  const handleSave = async (): Promise<void> => {
    const g = Math.max(0, Math.floor(Number(goal) || 0))
    if (g <= 0) return
    setSaving(true)
    await setDailyGoal(g)
    setSaving(false)
    onSaved()
  }

  return (
    <>
      <div className="space-y-4 overflow-y-auto px-5 py-4 text-[12px]">
        {/* 关键写作字数指标看板 */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-[10px] text-neutral-400">今日已写</div>
            <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neutral-900">
              {todayChars.toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-[10px] text-neutral-400">今日目标</div>
            <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neutral-900">
              {dailyGoal.toLocaleString('zh-CN')}
            </div>
          </div>
          <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
            <div className="text-[10px] text-neutral-400">完成进度</div>
            <div
              className={`mt-0.5 text-[16px] font-semibold tabular-nums ${
                reached ? 'text-status-success' : 'text-neutral-900'
              }`}
            >
              {pct}%
            </div>
          </div>
        </div>

        {/* 今日进度条 */}
        <div>
          <div className="mb-1 flex items-center justify-between text-[11px] text-neutral-400">
            <span>今日进度</span>
            <span className={reached ? 'font-medium text-status-success' : ''}>
              {reached ? '目标已达成' : `还差 ${remain.toLocaleString('zh-CN')} 字`}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-neutral-100">
            <div
              className={`h-full rounded-full transition-all duration-base ${
                reached ? 'bg-status-success' : 'bg-gradient-to-r from-brand-500 to-brand-300'
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>

        {/* 当前章节字数 */}
        <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
          <span className="text-neutral-500">当前章节字数</span>
          <span className="font-medium tabular-nums text-neutral-900">
            {charCount.toLocaleString('zh-CN')}
          </span>
        </div>

        {/* 作品字数统计（当前作品 / 全部作品累计；主进程按正文 + 备注内容全量核算） */}
        <div>
          <div className="mb-1 text-[11px] font-medium text-neutral-500">作品字数统计</div>
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-[10px] text-neutral-400">当前作品总字数</div>
              <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neutral-900">
                {workChars.toLocaleString('zh-CN')}
              </div>
            </div>
            <div className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
              <div className="text-[10px] text-neutral-400">全部作品累计字数</div>
              <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neutral-900">
                {totalChars.toLocaleString('zh-CN')}
              </div>
            </div>
          </div>
        </div>

        {/* 每日目标设置 */}
        <label className="block">
          <span className="mb-1 block text-neutral-500">每日目标字数</span>
          <input
            type="number"
            min={0}
            step={100}
            value={goal}
            onChange={(e) => setGoal(Number(e.target.value))}
            className="w-full rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2 text-[13px] text-neutral-900 outline-none focus:border-brand-500"
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 border-t border-neutral-200 px-5 py-3">
        <button className="btn-primary" onClick={() => void handleSave()} disabled={saving}>
          {saving ? '保存中…' : '保存'}
        </button>
      </div>
    </>
  )
}
