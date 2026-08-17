import React, { useState } from 'react'
import { LogoIcon } from './Icon'

const STEPS = [
  { title: '创建你的作品', desc: '在左侧点击「+ 作品」或使用顶部菜单「文件 → 新建作品」，填写书名与创作规划开始连载。也可以从欢迎页导入已有 Markdown 稿件。', icon: '✦' },
  { title: '开始写作', desc: '在编辑区输入正文，支持标题、表格、任务列表等块级格式；内容实时自动保存（Ctrl+S 立即落盘），状态栏显示字数与今日进度。', icon: '✎' },
  { title: '调用 AI 助手', desc: '选中正文后使用悬浮操作条（润色 / 改写 / 翻译 / 总结），或按 Ctrl+R 润色、Ctrl+Enter 续写。对话页可开启「注入知识库」，AI 将参考你的设定作答。', icon: '✦' }
] as const

/** FTUE 首次启动引导（A6）：3 步浮层，可跳过，完成后持久化不再展示。 */
export function FTUEGuide({ onFinish }: { onFinish: () => void }): React.JSX.Element {
  const [step, setStep] = useState(0)
  const s = STEPS[step]

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50">
      <div className="w-[420px] rounded-lg border border-neutral-200 bg-neutral-0 p-6 shadow-3">
        <div className="flex flex-col items-center gap-3">
          <LogoIcon size={44} />
          <h2 className="text-[18px] font-semibold text-neutral-900">欢迎使用续言 Continuum</h2>
          <p className="text-center text-[12px] text-neutral-500">三步上手中文网文写作</p>
        </div>

        <div className="mt-5 flex items-start gap-3 rounded-md bg-neutral-50 px-4 py-3">
          <span className="mt-0.5 text-[20px] leading-none text-brand-500">{s.icon}</span>
          <div>
            <div className="text-[14px] font-semibold text-neutral-900">
              {step + 1}. {s.title}
            </div>
            <p className="mt-1 text-[12px] leading-[1.7] text-neutral-600">{s.desc}</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {STEPS.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all duration-base ${
                i === step ? 'w-5 bg-brand-500' : 'w-1.5 bg-neutral-200'
              }`}
            />
          ))}
        </div>

        <div className="mt-5 flex items-center justify-between">
          <button className="text-[12px] text-neutral-400 hover:text-neutral-600" onClick={onFinish}>
            跳过引导
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <button className="btn-default" onClick={() => setStep((x) => x - 1)}>
                上一步
              </button>
            )}
            <button
              className="btn-primary"
              onClick={() => (step < STEPS.length - 1 ? setStep((x) => x + 1) : onFinish())}
            >
              {step < STEPS.length - 1 ? '下一步' : '开始创作'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
