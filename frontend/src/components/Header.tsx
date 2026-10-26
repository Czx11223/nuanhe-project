import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { getSiteSettings } from '../lib/api'
import type { SiteSetting } from '../types'

interface NavItem {
  label: string
  to: string
  children?: { label: string; to: string }[]
}

const NAV: NavItem[] = [
  { label: '首页', to: '/' },
  {
    label: '产品',
    to: '/products',
    children: [
      { label: '产品中心', to: '/products' },
      { label: '新案例展示', to: '/cases' }
    ]
  },
  {
    label: '新闻',
    to: '/news',
    children: [
      { label: '企业新闻', to: '/news?cat=企业新闻' },
      { label: '行业资讯', to: '/news?cat=行业资讯' }
    ]
  },
  {
    label: '招聘入口',
    to: '/recruitment',
    children: [
      { label: '社会招聘', to: '/recruitment?type=社会招聘' },
      { label: '校园招聘', to: '/recruitment?type=校园招聘' }
    ]
  },
  {
    label: '关于我们',
    to: '/about/暖禾',
    children: [
      { label: '关于暖禾', to: '/about/暖禾' },
      { label: '发展历程', to: '/about/history' },
      { label: '品牌介绍', to: '/about/brand' },
      { label: '联系我们', to: '/about/contact' }
    ]
  }
]

function isActive(loc: ReturnType<typeof useLocation>, to: string): boolean {
  const path = to.split('?')[0]
  if (path === '/') return loc.pathname === '/'
  return loc.pathname.startsWith(path)
}

export default function Header() {
  const loc = useLocation()
  const [openIdx, setOpenIdx] = useState<number | null>(null)
  const [drawer, setDrawer] = useState(false)
  // 站点设置：用于渲染后台配置的 Logo（logo_url）；未配置时回退站名文字
  const [site, setSite] = useState<SiteSetting | null>(null)

  useEffect(() => {
    getSiteSettings()
      .then(setSite)
      .catch(() => setSite(null))
  }, [])

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-200">
      <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2" onClick={() => setDrawer(false)}>
          {/* 后台「站点设置 → Logo」上传后在此渲染；未配置则回退站名文字 */}
          {site?.logo_url ? (
            <img
              src={site.logo_url}
              alt={site.site_name || '暖禾家具'}
              className="h-11 w-auto max-w-[200px] object-contain shrink-0"
            />
          ) : (
            <span className="text-lg font-semibold tracking-tight">
              {site?.site_name || '暖禾家具'}
            </span>
          )}
        </Link>

        {/* 桌面导航 */}
        <nav className="hidden md:flex items-center gap-1">
          {NAV.map((item, idx) => (
            <div
              key={item.label}
              className="relative"
              onMouseEnter={() => setOpenIdx(idx)}
              onMouseLeave={() => setOpenIdx(null)}
            >
              <Link
                to={item.to}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                  isActive(loc, item.to) ? 'text-brand' : 'text-gray-700 hover:text-brand'
                }`}
              >
                {item.label}
                {item.children && <span className="ml-1 text-xs">▾</span>}
              </Link>
              {item.children && openIdx === idx && (
                <div className="absolute left-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg py-1">
                  {item.children.map((c) => (
                    <Link
                      key={c.label}
                      to={c.to}
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-brand-light hover:text-brand"
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>

        <button className="md:hidden p-2" onClick={() => setDrawer((v) => !v)} aria-label="菜单">
          <div className="w-6 h-0.5 bg-gray-800 mb-1.5" />
          <div className="w-6 h-0.5 bg-gray-800 mb-1.5" />
          <div className="w-6 h-0.5 bg-gray-800" />
        </button>
      </div>

      {/* 移动端抽屉 */}
      {drawer && (
        <div className="md:hidden border-t border-gray-200 bg-white">
          {NAV.map((item) => (
            <div key={item.label} className="border-b border-gray-100">
              <Link
                to={item.to}
                className="block px-4 py-3 text-gray-800 font-medium"
                onClick={() => setDrawer(false)}
              >
                {item.label}
              </Link>
              {item.children && (
                <div className="bg-gray-50">
                  {item.children.map((c) => (
                    <Link
                      key={c.label}
                      to={c.to}
                      className="block px-8 py-2 text-sm text-gray-600"
                      onClick={() => setDrawer(false)}
                    >
                      {c.label}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </header>
  )
}
