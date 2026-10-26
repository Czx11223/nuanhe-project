// 后台列表统一分页配置（4 个列表页：产品/新闻/案例/招聘 复用）
// 功能：读取后端分页元信息（page/page_size/total），组装 antd Table pagination 配置：
//   - 上一页 / 页码按钮 / 下一页：antd Pagination 内置，第一页自动禁用「上一页」、
//     最后一页自动禁用「下一页」（边界由组件保证）；
//   - 跳转到指定页码：showQuickJumper 提供输入框；
//   - 总数展示：showTotal 显示「共 N 条」。
// 样式：跟随全局 AntD ConfigProvider 主题（主色 #007AFF，极简蓝调，无阴影）。
export interface PageMeta {
  page: number;
  page_size: number;
  total: number;
}

export function tablePagination(meta: PageMeta, onPageChange: (page: number) => void) {
  return {
    // 受控：当前页 / 每页条数 / 总数均来自后端返回
    current: meta.page,
    pageSize: meta.page_size,
    total: meta.total,
    // 跳页输入框 + 总数提示
    showQuickJumper: true,
    showTotal: (t: number) => `共 ${t} 条`,
    // 切换页码（页码按钮 / 上一页下一页 / 跳页）统一走此回调，由页面发起请求
    onChange: (p: number) => onPageChange(p),
  };
}
