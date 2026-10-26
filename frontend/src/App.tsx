import { Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout'
import Home from './pages/Home'
import Products from './pages/Products'
import ProductDetail from './pages/ProductDetail'
import Cases from './pages/Cases'
import CaseDetail from './pages/CaseDetail'
import News from './pages/News'
import NewsDetail from './pages/NewsDetail'
import Recruitment from './pages/Recruitment'
import RecruitmentDetail from './pages/RecruitmentDetail'
import About from './pages/About'
import Contact from './pages/Contact'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/products" element={<Products />} />
        <Route path="/products/:id" element={<ProductDetail />} />
        <Route path="/cases" element={<Cases />} />
        <Route path="/cases/:id" element={<CaseDetail />} />
        <Route path="/news" element={<News />} />
        <Route path="/news/:id" element={<NewsDetail />} />
        <Route path="/recruitment" element={<Recruitment />} />
        <Route path="/recruitment/:id" element={<RecruitmentDetail />} />
        <Route path="/about/contact" element={<Contact />} />
        <Route path="/about/:section" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
