// 产品详情
// 功能：展示产品封面/多图、名称、价格、描述、规格参数与相关推荐。
// 数据来源：getProduct(id)（后端校验上架状态，不存在时 404）与 getProducts()（相关推荐，客户端过滤）。
// 交互：封面图可在 gallery 多图间切换；loading / 404 态完整覆盖。

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { getProduct, getProducts } from '../lib/api'
import ImgPlaceholder from '../components/ImgPlaceholder'
import type { Product } from '../types'

export default function ProductDetail() {
  const { id } = useParams()
  // 产品详情 / 相关推荐 / 加载态 / 不存在标记 / 当前主图
  const [product, setProduct] = useState<Product | null>(null)
  const [related, setRelated] = useState<Product[]>([])
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [mainImg, setMainImg] = useState<string | null>(null)

  useEffect(() => {
    const pid = Number(id)
    if (!pid) {
      // 非法 id（非数字）直接视为不存在
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    let catId: number | null = null
    setLoading(true)
    // 拉取详情；成功后记录分类 id 用于相关推荐
    getProduct(pid)
      .then((p) => {
        if (cancelled) return
        setProduct(p)
        setMainImg(p.cover_image)
        catId = p.category_id
        // 拉取全部上架产品用于相关推荐（客户端过滤同分类，最多 4 个）
        return getProducts({ page_size: 100 })
      })
      .then((d) => {
        if (cancelled || !d) return
        setRelated(d.list.filter((x) => x.category_id === catId && x.id !== pid).slice(0, 4))
      })
      .catch(() => {
        if (!cancelled) setNotFound(true)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [id])

  // 加载中
  if (loading) {
    return <div className="max-w-6xl mx-auto px-4 py-20 text-center text-gray-400">加载中…</div>
  }

  // 不存在 / 已下架
  if (notFound || !product) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-3">商品不存在或已下架</h1>
        <Link to="/products" className="btn-primary">返回产品中心</Link>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="text-sm text-gray-400 mb-4">
        <Link to="/products" className="hover:text-brand">产品中心</Link> / {product.category_name || '全部'} / {product.name}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* 左侧：主图 + gallery 缩略图切换 */}
        <div>
          <ImgPlaceholder imageUrl={mainImg} label={product.name} className="h-80 md:h-96" />
          {product.gallery && product.gallery.length > 0 && (
            <div className="flex gap-2 mt-2">
              {/* 首图为封面，其余为 gallery 多图；点击切换主图 */}
              {[product.cover_image, ...product.gallery]
                .filter((g): g is string => !!g)
                .slice(0, 5)
                .map((g, i) => (
                  <button
                    key={i}
                    onClick={() => setMainImg(g)}
                    className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${
                      mainImg === g ? 'border-brand' : 'border-transparent'
                    }`}
                  >
                    <img src={g} alt={`${product.name} 图 ${i + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
            </div>
          )}
        </div>

        {/* 右侧：信息区 */}
        <div>
          <span className="tag">{product.category_name || '全部'}</span>
          <h1 className="text-2xl font-bold mt-3">{product.name}</h1>
          <div className="text-gray-400 text-sm mt-1">系列：{product.series} · 货号：{product.code}</div>
          <div className="text-brand text-2xl font-bold mt-4">
            {product.reference_price != null ? `¥${product.reference_price}` : '价格面议'}
          </div>
          {/* 产品介绍：富文本 HTML（后端入库前已 bleach 白名单清洗，安全）。
              用 dangerouslySetInnerHTML 渲染：<strong> 显示为加粗、<p> 自动分段换行，
              避免把标签当纯文本原样打印（.rich-text 样式见 index.css）。 */}
          <div className="rich-text mt-4" dangerouslySetInnerHTML={{ __html: product.description || '' }} />
          <div className="card p-4 mt-4">
            <h3 className="font-semibold mb-2">规格参数</h3>
            <p className="text-gray-600 text-sm whitespace-pre-line">{product.specs}</p>
          </div>
          <div className="flex gap-3 mt-6">
            <Link to="/about/contact" className="btn-primary">立即咨询</Link>
            <Link to="/about/contact" className="btn-ghost">预约到店</Link>
          </div>
        </div>
      </div>

      {/* 相关推荐 */}
      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="text-xl font-bold mb-4">相关推荐</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {related.map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="card overflow-hidden hover:border-brand transition">
                <ImgPlaceholder imageUrl={p.cover_image} label={p.name} className="h-40" rounded="rounded-none" />
                <div className="p-4">
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-brand font-semibold mt-2">
                    {p.reference_price != null ? `¥${p.reference_price}` : '价格面议'}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
