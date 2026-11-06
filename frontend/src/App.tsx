import { lazy, Suspense, type ReactNode } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'

// 路由级代码分割：首页静态导入保证首屏直出，其余页面按访问懒加载。
// 原先 11 个页面全部静态打进同一个 332KB bundle，落地页也要下载详情页代码。
const Products = lazy(() => import('./pages/Products'))
const ProductDetail = lazy(() => import('./pages/ProductDetail'))
const Cases = lazy(() => import('./pages/Cases'))
const CaseDetail = lazy(() => import('./pages/CaseDetail'))
const News = lazy(() => import('./pages/News'))
const NewsDetail = lazy(() => import('./pages/NewsDetail'))
const Recruitment = lazy(() => import('./pages/Recruitment'))
const RecruitmentDetail = lazy(() => import('./pages/RecruitmentDetail'))
const About = lazy(() => import('./pages/About'))
const Contact = lazy(() => import('./pages/Contact'))

// Suspense 边界包住单个路由 element，Layout（页头/页脚）在切换时不卸载。
function PageBoundary({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-16 text-center text-gray-400">加载中…</div>}>
      {children}
    </Suspense>
  )
}

const page = (node: ReactNode) => <PageBoundary>{node}</PageBoundary>

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={page(<Products />)} />
        <Route path="/products/:id" element={page(<ProductDetail />)} />
        <Route path="/cases" element={page(<Cases />)} />
        <Route path="/cases/:id" element={page(<CaseDetail />)} />
        <Route path="/news" element={page(<News />)} />
        <Route path="/news/:id" element={page(<NewsDetail />)} />
        <Route path="/recruitment" element={page(<Recruitment />)} />
        <Route path="/recruitment/:id" element={page(<RecruitmentDetail />)} />
        <Route path="/about/contact" element={page(<Contact />)} />
        <Route path="/about/:section" element={page(<About />)} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
