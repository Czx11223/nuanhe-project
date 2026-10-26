interface Props {
  /** 后端返回的图片地址（image_url / cover_image）；为空时回退品牌实色占位 */
  imageUrl?: string | null
  /** 占位时显示的文案（如产品名） */
  label?: string
  className?: string
  rounded?: string
}

// 图片占位组件：有图渲染 <img>，无图渲染品牌实色占位（bg-brand）。
// 遵守 UIUX 2.5 约束：不使用 box-shadow / 渐变 / text-shadow。
export default function ImgPlaceholder({
  imageUrl,
  label,
  className = '',
  rounded = 'rounded-lg'
}: Props) {
  // 后端返回了真实图片地址 → 直接渲染图片（object-cover 保证铺满容器）
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={label || ''}
        className={`${rounded} ${className} w-full h-full object-cover`}
      />
    )
  }
  // 无图 → 品牌实色占位（蓝底白字），可选展示文案
  return (
    <div className={`img-ph bg-brand ${rounded} ${className}`}>
      {label ? <span className="text-sm opacity-90">{label}</span> : null}
    </div>
  )
}
