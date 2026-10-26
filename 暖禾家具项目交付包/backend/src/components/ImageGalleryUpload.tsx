// 产品多图上传组件（表单受控）
// 功能：管理产品轮播图列表（第 2、3…N 张副图），支持：
//   - 添加：选择图片 → POST /api/upload → 追加到列表末尾
//   - 预览：每张图内嵌预览（点击可放大）
//   - 删除：移除任意一张
//   - 替换：任选一张重新上传覆盖该位置
// 约定：
//   - value: string[]（图片 URL 数组），onChange(next) 由父表单收集；
//   - 主图由现有「封面图」单图组件（cover_image）管理，本组件管理副图；
//   - 与后端 upload.py 规则一致：jpg/png/webp、≤5MB；与前端 ImageUpload 校验逻辑统一。
import { useState } from 'react';
import { App, Button, Image as AntImage, Upload } from 'antd';
import { DeleteOutlined, PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { post, resolveStatic } from '../lib/request';

interface Props {
  value?: string[];
  onChange?: (urls: string[]) => void;
  /** 最多允许的副图数量（默认 6；主图由封面图字段管理） */
  max?: number;
}

export default function ImageGalleryUpload({ value = [], onChange, max = 6 }: Props) {
  const { message } = App.useApp();
  const [uploading, setUploading] = useState(false);

  // 与后端 upload.py 严格一致：类型 jpg/png/webp、大小 ≤5MB
  const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
  const MAX_SIZE = 5 * 1024 * 1024;

  /** 校验并上传单个文件，成功返回可访问 URL；校验失败抛错（错误提示由拦截器/本地 Toast 完成） */
  const uploadOne = async (file: File): Promise<string> => {
    if (!ALLOWED.includes(file.type)) {
      message.error('仅支持 jpg / png / webp 图片');
      throw new Error('unsupported type');
    }
    if (file.size > MAX_SIZE) {
      message.error('文件大小不能超过 5MB');
      throw new Error('oversize');
    }
    const fd = new FormData();
    fd.append('file', file);
    const res = await post<{ url: string }>('/api/upload', fd);
    return res.url;
  };

  /** 添加图片：追加到列表末尾（超上限时拦截） */
  const handleAdd: UploadProps['beforeUpload'] = async (file) => {
    if (value.length >= max) {
      message.error(`最多上传 ${max} 张副图`);
      return false;
    }
    setUploading(true);
    try {
      const url = await uploadOne(file as File);
      onChange?.([...value, url]);
      message.success('上传成功');
    } catch {
      // 错误已提示
    } finally {
      setUploading(false);
    }
    return false; // 阻止 antd 自动上传
  };

  /** 替换第 index 张：重新上传后覆盖该位置 */
  const handleReplace = (index: number): UploadProps['beforeUpload'] => async (file) => {
    setUploading(true);
    try {
      const url = await uploadOne(file as File);
      const next = [...value];
      next[index] = url;
      onChange?.(next);
      message.success('替换成功');
    } catch {
      // 错误已提示
    } finally {
      setUploading(false);
    }
    return false;
  };

  /** 删除第 index 张 */
  const removeAt = (index: number) => {
    onChange?.(value.filter((_, i) => i !== index));
  };

  return (
    <div>
      {/* 图片列表：预览 + 替换 + 删除 */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {value.map((url, i) => (
          <div key={i} style={{ width: 92 }}>
            <AntImage
              src={resolveStatic(url)}
              width={92}
              height={92}
              style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E5EA' }}
              alt={`副图 ${i + 1}`}
            />
            <div style={{ marginTop: 4, display: 'flex', gap: 4 }}>
              {/* 替换：内嵌 Upload，重新选择后覆盖该张 */}
              <Upload
                accept="image/jpeg,image/png,image/webp"
                showUploadList={false}
                beforeUpload={handleReplace(i)}
              >
                <Button size="small" icon={<ReloadOutlined />} disabled={uploading}>
                  替换
                </Button>
              </Upload>
              <Button size="small" danger icon={<DeleteOutlined />} onClick={() => removeAt(i)}>
                删除
              </Button>
            </div>
          </div>
        ))}

        {/* 添加按钮（虚线占位） */}
        {value.length < max && (
          <Upload accept="image/jpeg,image/png,image/webp" showUploadList={false} beforeUpload={handleAdd}>
            <div
              style={{
                width: 92,
                height: 92,
                border: '1px dashed #E5E5EA',
                borderRadius: 8,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                color: '#6E6E73',
              }}
            >
              <PlusOutlined />
              <span style={{ fontSize: 12 }}>添加</span>
            </div>
          </Upload>
        )}
      </div>
      <div style={{ color: '#AEAEB2', fontSize: 12, marginTop: 6 }}>
        最多 {max} 张轮播副图；可添加、替换、删除（第一张主图请在上方「封面图」上传）
      </div>
    </div>
  );
}
