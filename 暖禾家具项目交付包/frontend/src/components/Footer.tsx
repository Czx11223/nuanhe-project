// 页脚组件
// 功能：展示品牌简介、快速导航、关于链接与联系信息。
// 数据来源：站点设置通过 getSiteSettings() 获取（api 层有模块级缓存，避免多页重复请求）；
// 未配置或加载失败时回退默认文案，保证任何情况下页脚可渲染。

import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getSiteSettings } from '../lib/api'
import type { SiteSetting } from '../types'

export default function Footer() {
  // 站点设置状态：null 表示未加载/加载失败，使用默认文案兜底
  const [site, setSite] = useState<SiteSetting | null>(null)

  useEffect(() => {
    // 挂载时拉取站点设置；失败静默兜底（不影响页脚整体展示）
    getSiteSettings()
      .then(setSite)
      .catch(() => setSite(null))
  }, [])

  // 站点名称/备案号等字段允许为空，给出默认值保证渲染
  const siteName = site?.site_name || '暖禾家具'

  return (
    <footer className="bg-white border-t border-gray-200 mt-16">
      <div className="max-w-6xl mx-auto px-4 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-sm">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-7 h-7 rounded-lg bg-brand text-white grid place-items-center font-bold">L</span>
            <span className="font-semibold">{siteName}</span>
          </div>
          <p className="text-gray-500 leading-relaxed">
            匠心家居，悦享生活。<br />研发 · 制造 · 销售一体化。
          </p>
        </div>

        <div>
          <h4 className="font-semibold mb-3">快速导航</h4>
          <ul className="space-y-2 text-gray-500">
            <li><Link to="/products" className="hover:text-brand">产品中心</Link></li>
            <li><Link to="/cases" className="hover:text-brand">新案例展示</Link></li>
            <li><Link to="/news" className="hover:text-brand">新闻资讯</Link></li>
            <li><Link to="/recruitment" className="hover:text-brand">招聘入口</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">关于</h4>
          <ul className="space-y-2 text-gray-500">
            <li><Link to="/about/暖禾" className="hover:text-brand">关于暖禾</Link></li>
            <li><Link to="/about/history" className="hover:text-brand">发展历程</Link></li>
            <li><Link to="/about/brand" className="hover:text-brand">品牌介绍</Link></li>
            <li><Link to="/about/contact" className="hover:text-brand">联系我们</Link></li>
          </ul>
        </div>

        <div>
          <h4 className="font-semibold mb-3">联系我们</h4>
          <ul className="space-y-2 text-gray-500">
            <li>地址：{site?.address || '未配置'}</li>
            <li>电话：{site?.phone || '未配置'}</li>
            <li>邮箱：{site?.email || '未配置'}</li>
            <li>时间：{site?.business_hours || '未配置'}</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-gray-100 py-4 text-center text-xs text-gray-400">
        © 2026 {siteName} · {site?.icp || ''}
      </div>
    </footer>
  )
}
