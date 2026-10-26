// Ant Design 主题令牌（极简蓝调 · Apple 变体）
// 严格对应 UIUX 文档第 2 章设计令牌：主色 #007AFF、圆角 8px、字号 14、浅色背景。
// 阴影统一禁用（UIUX 2.5），组件层通过 inline style 的 boxShadow:'none' 落实。
import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#007AFF', // 主色
    colorPrimaryHover: '#0066D6', // 主色悬浮
    colorPrimaryActive: '#0055B3', // 主色按下
    colorSuccess: '#34C759',
    colorWarning: '#FF9500',
    colorError: '#FF3B30',
    colorBgLayout: '#F5F5F7', // 页面背景
    colorBgContainer: '#FFFFFF', // 卡片背景
    colorText: '#1D1D1F', // 主文字
    colorTextSecondary: '#6E6E73', // 次文字
    colorTextTertiary: '#AEAEB2', // 辅文字
    colorBorder: '#E5E5EA', // 边框
    borderRadius: 8, // 圆角 md
    fontSize: 14,
    fontWeightStrong: 600, // 仅 400/600
    controlHeight: 36,
  },
};
