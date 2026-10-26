// 招聘列表
// 功能：按类型 Tab（全部/社会招聘/校园招聘）筛选在招职位。
// 数据来源：getRecruitments() 分页接口；type 参数（1 社会/2 校园）直接传给后端过滤。
// 说明：后端返回 type_label 中文标签，前端直接渲染，不再本地映射。

import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getRecruitments } from '../lib/api'
import type { Recruitment, RecruitType } from '../types'

const TABS: { label: string; value: RecruitType | '全部' }[] = [
  { label: '全部', value: '全部' },
  { label: '社会招聘', value: 1 },
  { label: '校园招聘', value: 2 }
]

export default function Recruitment() {
  const [params, setParams] = useSearchParams()
  // URL 查询参数驱动类型：?type=社会招聘 / ?type=校园招聘（导航可直达）
  const typeParamRaw = params.get('type')
  const typeParam: RecruitType | '全部' =
    typeParamRaw === '社会招聘' ? 1 : typeParamRaw === '校园招聘' ? 2 : '全部'
  const setType = (v: RecruitType | '全部') => {
    if (v === '全部') setParams({})
    else setParams({ type: v === 1 ? '社会招聘' : '校园招聘' })
  }

  const [list, setList] = useState<Recruitment[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    // 「全部」时不传 type，后端返回所有在招职位（status=1）
    getRecruitments({ type: typeParam === '全部' ? undefined : typeParam, page_size: 100 })
      .then((d) => {
        if (!cancelled) setList(d.list)
      })
      .catch(() => {
        if (!cancelled) setList([])
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [typeParam])

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">招聘入口</h1>
      <p className="text-gray-500 mt-1">与 暖禾 同行，共创美好生活</p>

      <div className="flex gap-2 mt-6">
        {TABS.map((t) => (
          <button
            key={t.label}
            onClick={() => setType(t.value)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              typeParam === t.value ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700 hover:border-brand'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="space-y-4 mt-6">
        {list.map((r) => (
          <Link key={r.id} to={`/recruitment/${r.id}`} className="card p-5 flex items-center justify-between hover:border-brand transition">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold">{r.title}</h3>
                {/* type_label 由后端映射（1 社会招聘 / 2 校园招聘） */}
                <span className="tag">{r.type_label}</span>
              </div>
              <div className="text-gray-400 text-sm mt-1">{r.department} · {r.location}</div>
            </div>
            <span className="text-brand">查看 →</span>
          </Link>
        ))}
        {!loading && list.length === 0 && <p className="text-center text-gray-400 py-12">该类型暂无在招职位</p>}
        {loading && <p className="text-center text-gray-400 py-12">加载中…</p>}
      </div>
    </div>
  )
}
