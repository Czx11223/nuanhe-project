// 关于我们
// 功能：三个子板块（关于暖禾 / 发展历程 / 品牌介绍）切换展示。
// 数据来源：发展历程用前端品牌骨架常量 historyTimeline；
// 其余板块调 getAboutContents(section) 获取富文本内容（section=about_暖禾 / history / brand）。
// 富文本：content 为后端 bleach 清洗后的 HTML，使用 dangerouslySetInnerHTML 渲染。

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getAboutContents } from '../lib/api'
import { historyTimeline } from '../lib/constants'
import type { AboutContent } from '../types'

// 路由段 → 后端 section 值 的映射：/about/暖禾 → about_暖禾
const SECTION_MAP: Record<string, string> = {
  暖禾: 'about_暖禾',
  history: 'history',
  brand: 'brand'
}

const SECTIONS = [
  { key: '暖禾', label: '关于暖禾', to: '/about/暖禾' },
  { key: 'history', label: '发展历程', to: '/about/history' },
  { key: 'brand', label: '品牌介绍', to: '/about/brand' }
] as const

export default function About() {
  const { section = '暖禾' } = useParams()
  // 当前板块的富文本内容（history 板块不使用）
  const [content, setContent] = useState<AboutContent | null>(null)
  const [loading, setLoading] = useState(false)
  const active = SECTIONS.find((s) => s.key === section)?.key ?? '暖禾'

  useEffect(() => {
    // 发展历程使用前端常量，不请求接口
    if (section === 'history') {
      setContent(null)
      return
    }
    let cancelled = false
    setLoading(true)
    // 按后端 section 值拉取板块内容，取第一条（后台每板块单条）
    getAboutContents(SECTION_MAP[section] || 'about_暖禾')
      .then((list) => {
        if (!cancelled) setContent(list[0] ?? null)
      })
      .catch(() => {
        if (!cancelled) setContent(null)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [section])

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">关于我们</h1>

      {/* 板块切换 */}
      <div className="flex flex-wrap gap-2 mt-6">
        {SECTIONS.map((s) => (
          <Link
            key={s.key}
            to={s.to}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              active === s.key ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700 hover:border-brand'
            }`}
          >
            {s.label}
          </Link>
        ))}
        <Link
          to="/about/contact"
          className="px-4 py-2 rounded-lg text-sm border border-gray-300 text-gray-700 hover:border-brand"
        >
          联系我们
        </Link>
      </div>

      <div className="mt-8">
        {section === 'history' ? (
          // 发展历程：品牌骨架常量时间轴
          <div>
            <h2 className="text-xl font-bold mb-6">发展历程</h2>
            <div className="border-l-2 border-brand-light pl-6 space-y-8">
              {historyTimeline.map((h) => (
                <div key={h.year} className="relative">
                  <span className="absolute -left-[31px] top-1 w-4 h-4 rounded-full bg-brand border-4 border-white" />
                  <div className="text-brand font-bold">{h.year}</div>
                  <p className="text-gray-600 mt-1">{h.text}</p>
                </div>
              ))}
            </div>
          </div>
        ) : loading ? (
          <p className="text-gray-400">加载中…</p>
        ) : content ? (
          // 富文本板块内容
          <div className="card p-8">
            <h2 className="text-xl font-bold mb-4">{content.title}</h2>
            <div className="rich-text" dangerouslySetInnerHTML={{ __html: content.content || '' }} />
          </div>
        ) : (
          <p className="text-gray-400">内容维护中</p>
        )}
      </div>
    </div>
  )
}
