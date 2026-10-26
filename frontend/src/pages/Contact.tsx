// 联系我们
// 功能：展示公司联系信息（站点设置），并提供留言/预约/咨询表单（真实提交到后端 /api/messages）。
// 数据来源：getSiteSettings()（含地址/电话/邮箱/经纬度等）。
// 表单：react-hook-form + zod 校验；type 可选 留言/预约/咨询，成功后展示成功卡片。

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { getSiteSettings, postMessage } from '../lib/api'
import type { SiteSetting } from '../types'

// 留言表单校验规则（zod）：姓名/电话/内容必填，邮箱选填需符合格式
const contactSchema = z.object({
  name: z.string().min(2, '请填写姓名（至少 2 字）'),
  phone: z.string().regex(/^1\d{10}$/, '请填写 11 位手机号'),
  email: z.string().email('邮箱格式不正确').optional().or(z.literal('')),
  type: z.enum(['留言', '预约', '咨询']),
  content: z.string().min(5, '请填写您的需求（至少 5 字）')
})
type ContactForm = z.infer<typeof contactSchema>

export default function Contact() {
  // 站点设置（公司信息）
  const [site, setSite] = useState<SiteSetting | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [sent, setSent] = useState(false)

  // 表单实例：zod 校验
  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<ContactForm>({
    resolver: zodResolver(contactSchema),
    defaultValues: { name: '', phone: '', email: '', type: '留言', content: '' }
  })

  useEffect(() => {
    // 拉取站点设置展示公司信息；失败静默兜底
    getSiteSettings()
      .then(setSite)
      .catch(() => setSite(null))
  }, [])

  // 提交表单：调用公开留言接口；成功后展示成功卡片
  const onSubmit = async (values: ContactForm) => {
    setSubmitting(true)
    try {
      await postMessage({
        name: values.name,
        phone: values.phone,
        email: values.email || undefined,
        type: values.type,
        content: values.content
      })
      setSent(true)
    } catch {
      // 错误提示已由 request 层统一处理（toast）
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold">联系我们</h1>
      <p className="text-gray-500 mt-1">欢迎到店体验，或留下您的需求</p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        {/* 公司信息 */}
        <div className="card p-6 space-y-4">
          <h3 className="font-semibold">公司信息</h3>
          <div className="text-sm text-gray-600 space-y-2">
            <div><span className="text-gray-400">地址：</span>{site?.address || '未配置'}</div>
            <div><span className="text-gray-400">电话：</span>{site?.phone || '未配置'}</div>
            <div><span className="text-gray-400">邮箱：</span>{site?.email || '未配置'}</div>
            <div><span className="text-gray-400">营业时间：</span>{site?.business_hours || '未配置'}</div>
            <div><span className="text-gray-400">备案号：</span>{site?.icp || '未配置'}</div>
          </div>
          {/* 地图占位：已配置经纬度时显示占位（真实地图服务后续可接入） */}
          <div className="h-40 rounded-lg bg-brand-light grid place-items-center text-brand/70 text-sm">
            {site?.latitude && site?.longitude
              ? `地图占位（${site.latitude}, ${site.longitude}）`
              : '地图占位（未配置经纬度）'}
          </div>
        </div>

        {/* 留言 / 预约 / 咨询表单：真实提交到后端 */}
        <div className="card p-6">
          <h3 className="font-semibold mb-4">留言 / 预约</h3>
          {sent ? (
            <div className="text-brand font-medium">✓ 提交成功，我们会尽快与你联系</div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              <div>
                <select {...register('type')} className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-full">
                  <option value="留言">留言</option>
                  <option value="预约">预约</option>
                  <option value="咨询">咨询</option>
                </select>
              </div>
              <div>
                <textarea
                  {...register('content')}
                  className={`border rounded-lg px-3 py-2 text-sm w-full h-24 ${errors.content ? 'border-red-400' : 'border-gray-300'}`}
                  placeholder="您的需求 *"
                />
                {errors.content && <p className="text-red-500 text-xs mt-1">{errors.content.message}</p>}
              </div>
              <button type="submit" disabled={submitting} className="btn-primary w-full disabled:opacity-60">
                {submitting ? '提交中…' : '提交'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
