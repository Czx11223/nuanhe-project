// 产品中心
// 功能：分类筛选 + 上架产品网格展示。
// 数据来源：getProductCategories()（分类树）与 getProducts()（上架产品分页，取 page_size=100 全量）。
// 筛选策略：分类筛选在客户端完成（一次性加载后本地过滤，交互零延迟）。

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getProductCategories, getProducts } from '../lib/api'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { Product, ProductCategory } from '../types'

export default function Products() {
  // 分类树 / 产品列表 / 加载态 / 当前选中分类
  const [cats, setCats] = useState<ProductCategory[]>([])
  const [list, setList] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [cat, setCat] = useState<number | null>(null)

  useEffect(() => {
    // 并行加载分类树与全部上架产品；失败兜底为空数组
    getProductCategories().then(setCats).catch(() => setCats([]))
    getProducts({ page_size: 100 })
      .then((d) => setList(d.list))
      .catch(() => setList([]))
      .finally(() => setLoading(false))
  }, [])

  // 扁平化分类树（含二级 children），供名称反查
  const allCats = cats.flatMap((c) => [c, ...(c.children || [])])
  const catName = (id: number | null) => allCats.find((c) => c.id === id)?.name ?? ''

  // 仅展示上架产品，并按选中分类客户端过滤
  const visible = list.filter((p) => p.status === 1 && (cat === null || p.category_id === cat))

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">产品中心</h1>
      <p className="text-gray-500 mt-1">探索暖禾全系列家居产品</p>

      {/* 分类筛选：仅展示一级分类 */}
      <div className="flex flex-wrap gap-2 mt-6">
        <button
          onClick={() => setCat(null)}
          className={`px-4 py-2 rounded-lg text-sm border transition ${
            cat === null ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700 hover:border-brand'
          }`}
        >
          全部
        </button>
        {cats.map((c) => (
          <button
            key={c.id}
            onClick={() => setCat(c.id)}
            className={`px-4 py-2 rounded-lg text-sm border transition ${
              cat === c.id ? 'bg-brand text-white border-brand' : 'border-gray-300 text-gray-700 hover:border-brand'
            }`}
          >
            {c.name}
          </button>
        ))}
      </div>

      {/* 产品网格 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        {visible.map((p) => (
          <Link key={p.id} to={`/products/${p.id}`} className="card overflow-hidden hover:border-brand transition">
            <ImgPlaceholder imageUrl={p.cover_image} label={p.name} className="h-44" rounded="rounded-none" />
            <div className="p-4">
              <div className="font-medium truncate">{p.name}</div>
              <div className="text-gray-400 text-xs mt-1">{catName(p.category_id)} · {p.code}</div>
              <div className="text-brand font-semibold mt-2">
                {p.reference_price != null ? `¥${p.reference_price}` : '价格面议'}
              </div>
            </div>
          </Link>
        ))}
        {!loading && visible.length === 0 && (
          <p className="col-span-full text-center text-gray-400 py-12">该分类暂无上架产品</p>
        )}
        {loading && <p className="col-span-full text-center text-gray-400 py-12">加载中…</p>}
      </div>
    </div>
  )
}
