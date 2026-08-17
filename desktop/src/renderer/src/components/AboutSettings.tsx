import React, { useEffect, useState } from 'react'
import { CHANGELOG } from '@shared/changelog'

/**
 * 版本信息设置模块（设置中心「关于」Tab）：
 * - 顶部：应用名称 + 当前版本号（主进程 package.json version，实时读取）；
 * - 下方：更新信息列表（按版本迭代时间倒序），含发布日期、新增功能、问题修复。
 * 仅展示只读信息，无保存动作，样式与设置中心其余分类保持一致。
 */
export function AboutSection(): React.JSX.Element {
  const [appVersion, setAppVersion] = useState<string>('')

  useEffect(() => {
    void window.api.app.version().then((v) => setAppVersion(v ?? ''))
  }, [])

  return (
    <div className="space-y-4 overflow-y-auto px-5 py-4 text-[12px]">
      {/* 当前版本卡片 */}
      <div className="flex items-center justify-between rounded-md border border-neutral-200 bg-neutral-50 px-3 py-2">
        <div>
          <div className="text-[10px] text-neutral-400">续言 Continuum</div>
          <div className="mt-0.5 text-[16px] font-semibold tabular-nums text-neutral-900">
            v{appVersion || '—'}
          </div>
        </div>
        <span className="rounded-full bg-brand-50 px-2 py-0.5 text-[10px] font-medium text-brand-500">
          当前版本
        </span>
      </div>

      {/* 更新信息（按版本迭代时间倒序） */}
      <div>
        <div className="mb-2 text-[11px] font-medium text-neutral-500">更新信息</div>
        <div className="space-y-3">
          {CHANGELOG.map((entry) => (
            <div
              key={`${entry.version}-${entry.date}`}
              className="rounded-md border border-neutral-200 bg-neutral-50 px-3 py-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[13px] font-semibold text-neutral-900">
                  {entry.version}
                  {entry.latest && (
                    <span className="ml-1.5 rounded-full bg-brand-50 px-1.5 py-0.5 text-[10px] font-medium text-brand-500">
                      最新
                    </span>
                  )}
                </span>
                <span className="shrink-0 text-[11px] text-neutral-500">{entry.date}</span>
              </div>

              {entry.features.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {entry.features.map((f) => (
                    <li key={f} className="flex gap-1.5 text-[12px] leading-relaxed text-neutral-700">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-brand-500" />
                      <span className="min-w-0">{f}</span>
                    </li>
                  ))}
                </ul>
              )}

              {entry.fixes.length > 0 && (
                <ul className="mt-2 space-y-1 border-t border-neutral-200 pt-2">
                  {entry.fixes.map((f) => (
                    <li key={f} className="flex gap-1.5 text-[12px] leading-relaxed text-neutral-700">
                      <span className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-status-success" />
                      <span className="min-w-0">修复：{f}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
