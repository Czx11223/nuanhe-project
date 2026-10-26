// 页面标题组件（面包屑/工具栏位置）
// 统一各模块页面的标题与右侧操作区（如“新增”按钮）。
import type { ReactNode } from 'react';

interface Props {
  title: string;
  /** 标题右侧操作区（按钮组等） */
  extra?: ReactNode;
}

export default function PageHeader({ title, extra }: Props) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 16,
      }}
    >
      <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>{title}</h2>
      <div>{extra}</div>
    </div>
  );
}
