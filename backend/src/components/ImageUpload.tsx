// 图片上传组件（表单受控）
// 功能：选择本地图片 → 调用 POST /api/upload（后端校验 image/jpeg|png|webp ≤5MB）→
//       返回 {url} → 通过 onChange 写入表单字段；并展示预览（拼接静态前缀）。
// 受控用法：value 为当前图片地址，onChange(url) 由父表单收集。
import { useState } from 'react';
import { App, Button, Upload, Image as AntImage } from 'antd';
import { UploadOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { post, resolveStatic } from '../lib/request';

interface Props {
  value?: string;
  onChange?: (url: string) => void;
}

export default function ImageUpload({ value, onChange }: Props) {
  const { message } = App.useApp();
  const [loading, setLoading] = useState(false);

  // 与后端 upload.py 规则严格一致：类型 jpg/png/webp，大小 ≤ 5MB。
  // 前置校验失败时直接提示并阻止上传，避免无效请求打到后端。
  const validate = (file: File): boolean => {
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (!ALLOWED.includes(file.type)) {
      message.error('仅支持 jpg / png / webp 图片');
      return false;
    }
    if (file.size > MAX_SIZE) {
      message.error('文件大小不能超过 5MB');
      return false;
    }
    return true;
  };

  // 覆盖 antd 默认上传，改为手动上传到 /api/upload
  const beforeUpload: UploadProps['beforeUpload'] = async (file) => {
    // 1. 前端前置校验：类型 / 大小不符直接拦截（后端仍会二次校验兜底）
    if (!validate(file as File)) return false;
    const formData = new FormData();
    formData.append('file', file);
    setLoading(true);
    try {
      const res = await post<{ url: string }>('/api/upload', formData);
      onChange?.(res.url);
      message.success('上传成功');
    } catch {
      // 拦截器已 Toast（如类型/大小不符的后端校验或网络异常）
    } finally {
      setLoading(false);
    }
    return false; // 阻止 antd 自动上传
  };

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {/* 预览 */}
      {value && (
        <AntImage
          src={resolveStatic(value)}
          alt="预览"
          width={88}
          height={88}
          style={{ objectFit: 'cover', borderRadius: 8, border: '1px solid #E5E5EA' }}
        />
      )}
      <Upload beforeUpload={beforeUpload} showUploadList={false} accept="image/jpeg,image/png,image/webp">
        <Button icon={<UploadOutlined />} loading={loading}>
          {value ? '更换图片' : '上传图片'}
        </Button>
      </Upload>
    </div>
  );
}
