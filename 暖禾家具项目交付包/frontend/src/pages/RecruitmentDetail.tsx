// 招聘详情
// 功能：展示职位职责/要求，并提供在线简历投递表单（真实提交到后端 /api/messages）。
// 数据来源：getRecruitment(id)（后端校验 status=1）。
// 表单：react-hook-form + zod 校验；提交 type=「简历投递」，成功后显示成功提示。

import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getRecruitment, postMessage } from '../lib/api'
import type { Recruitment } from '../types'

// 简历投递表单校验规则（zod）：
//  - 姓名必填（至少 2 字）
//  - 手机号必填，须为 11 位大陆手机号
//  - 邮箱选填，填写时须符合格式
//  - 自我介绍选填
const resumeSchema = z.object({
  name: z.string().min(2, '请填写姓名（至少 2 字）'),
  phone: z.string().regex(/^1\d{10}$/, '请填写 11 位手机号'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  content: z.string().optional()
})
type ResumeForm = z.infer<typeof resumeSchema>

export default function RecruitmentDetail() {
  const { id } = useParams()
  const [job, setJob] = useState<Recruitment | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  // 表单实例：zod 校验 + 提交中状态
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ResumeForm>({
    resolver: zodResolver(resumeSchema),
    defaultValues: { name: '', phone: '', email: '', content: '' }
  })

  useEffect(() => {
    const pid = Number(id)
    if (!pid) {
      setNotFound(true)
      setLoading(false)
      return
    }
    let cancelled = false
    setLoading(true)
    getRecruitment(pid)
      .then((d) => {
        if (!cancelled) setJob(d)
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

  // 提交简历：调用公开留言接口，type=简历投递；成功后展示成功卡片
  const onSubmit = async (values: ResumeForm) => {
    setSubmitting(true)
    try {
      await postMessage({
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        type: '简历投递',
        content: values.content || undefined
      })
      setSent(true)
    } catch {
      // 错误提示已由 request 层统一处理（toast）
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-20 text-center text-gray-400">加载中…</div>
  }

  if (notFound || !job) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <h1 className="text-xl font-bold mb-3">职位不存在或已停用</h1>
        <Link to="/recruitment" className="btn-primary">返回招聘列表</Link>
      </div>
    )
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="text-sm text-gray-400 mb-4">
        <Link to="/recruitment" className="hover:text-brand">招聘入口</Link> / {job.title}
      </div>
      {/* type_label 由后端映射 */}
      <span className="tag">{job.type_label}</span>
      <h1 className="text-2xl font-bold mt-2">{job.title}</h1>
      <div className="text-gray-400 text-sm mt-1">{job.department} · {job.location}</div>

      <div className="card p-5 mt-6">
        <h3 className="font-semibold mb-2">岗位职责</h3>
        {/* 富文本 HTML（后端已 bleach 清洗）：dangerouslySetInnerHTML 渲染，避免标签原样显示 */}
        <div className="rich-text text-sm" dangerouslySetInnerHTML={{ __html: job.description || '' }} />
      </div>
      <div className="card p-5 mt-4">
        <h3 className="font-semibold mb-2">任职要求</h3>
        <div className="rich-text text-sm" dangerouslySetInnerHTML={{ __html: job.requirements || '' }} />
      </div>

      {sent ? (
        // 提交成功卡片
        <div className="card p-6 mt-6 text-center text-brand font-medium">
          ✓ 简历投递成功，感谢你的关注，我们会尽快与你联系
        </div>
      ) : (
        // 简历投递表单：真实提交到后端
        <div className="card p-6 mt-6">
          <h3 className="font-semibold mb-4">在线投递简历</h3>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <input
                  {...register('name')}
                  className={`border rounded-lg px-3 py-2 text-sm w-full ${errors.name ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="姓名 *"
                />
                {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
              </div>
              <div>
                <input
                  {...register('phone')}
                  className={`border rounded-lg px-3 py-2 text-sm w-full ${errors.phone ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="电话 *"
                />
                {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
              </div>
            </div>
            <div>
              <input
                {...register('email')}
                className={`border rounded-lg px-3 py-2 text-sm w-full ${errors.email ? 'border-red-400' : 'border-gray-300'}`}
                placeholder="邮箱（选填）"
              />
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <textarea
              {...register('content')}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full h-24"
              placeholder="自我介绍 / 留言（选填）"
            />
            <button type="submit" disabled={submitting} className="btn-primary disabled:opacity-60">
              {submitting ? '提交中…' : '提交投递'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
