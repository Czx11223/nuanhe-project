// 案例列表
// 功能：展示启用中的项目案例（按 sort 升序，即后台置顶排序生效）。
// 数据来源：getCases() 分页接口，取 page_size=100 全量后客户端排序/过滤。

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCases } from '../lib/api'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { CaseItem } from '../types'

export default function Cases() {
  const [list, setList] = useState<CaseItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // 拉取启用中的案例（后端已过滤 status=1）；失败兜底为空
    getCases({ page_size: 100 })
      .then((d) => setList(d.list))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [])

  // 客户端再按 sort 升序（置顶优先），与后台排序逻辑一致
  const visible = [...list].sort((a, b) => a.sort - b.sort)

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">新案例展示</h1>
      <p className="text-gray-500 mt-1">看见设计的力量，了解 暖禾 的真实落地</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
        {visible.map((c) => (
          <Link key={c.id} to={`/cases/${c.id}`} className="card overflow-hidden hover:border-brand transition">
            <ImgPlaceholder imageUrl={c.cover_image} label={c.title} className="h-52" rounded="rounded-none" />
            <div className="p-5">
              {c.category && <span className="tag">{c.category}</span>}
              <h3 className="font-semibold mt-2 text-lg">{c.title}</h3>
              <p className="text-gray-500 text-sm mt-2 line-clamp-2">{c.summary}</p>
            </div>
          </Link>
        ))}
        {!loading && visible.length === 0 && <p className="col-span-full text-center text-gray-400 py-12">暂无案例</p>}
        {loading && <p className="col-span-full text-center text-gray-400 py-12">加载中…</p>}
      </div>
    </div>
  )
}
