// 富文本编辑器（基于 TipTap）
// 用途：关于我们、新闻、案例、招聘等正文编辑。StarterKit 提供基础排版，
// 另启用 Link / Image 扩展；提交后经后端 bleach 白名单清洗（引技术文档 4.5）。
// 注意：组件同步父组件传入的 value（编辑回显），仅在不一致时回填，避免输入抖动。
import { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Link from '@tiptap/extension-link';
import Image from '@tiptap/extension-image';
import { Button, Space } from 'antd';

interface Props {
  value?: string;
  onChange?: (html: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: Props) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      // 链接：点击不跳转，强制 rel 防止反向标签页攻击
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Image,
    ],
    content: value || '',
    editorProps: {
      attributes: { class: '暖禾-rte' },
    },
    onUpdate: ({ editor }) => {
      onChange?.(editor.getHTML());
    },
  });

  // 父组件 value 变化（如切换编辑对象）时回填编辑器
  useEffect(() => {
    if (editor && value !== undefined && value !== editor.getHTML()) {
      editor.commands.setContent(value || '', false);
    }
  }, [value, editor]);

  if (!editor) return null;

  // 工具栏按钮：根据当前选区状态高亮
  const Btn = ({
    active,
    onClick,
    children,
  }: {
    active: boolean;
    onClick: () => void;
    children: React.ReactNode;
  }) => (
    <Button
      size="small"
      type={active ? 'primary' : 'text'}
      onClick={onClick}
      style={{ fontWeight: 600 }}
    >
      {children}
    </Button>
  );

  return (
    <div style={{ border: '1px solid #E5E5EA', borderRadius: 8, overflow: 'hidden' }}>
      {/* 工具栏 */}
      <Space style={{ padding: 8, borderBottom: '1px solid #E5E5EA', flexWrap: 'wrap' }}>
        <Btn active={editor.isActive('bold')} onClick={() => editor.chain().focus().toggleBold().run()}>
          B
        </Btn>
        <Btn active={editor.isActive('italic')} onClick={() => editor.chain().focus().toggleItalic().run()}>
          I
        </Btn>
        <Btn active={editor.isActive('strike')} onClick={() => editor.chain().focus().toggleStrike().run()}>
          S
        </Btn>
        <Btn active={editor.isActive('heading', { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
          H1
        </Btn>
        <Btn active={editor.isActive('heading', { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
          H2
        </Btn>
        <Btn active={editor.isActive('bulletList')} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          • 列表
        </Btn>
        <Btn active={editor.isActive('orderedList')} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          1. 列表
        </Btn>
        <Btn active={editor.isActive('blockquote')} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          引用
        </Btn>
        <Btn active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          分割线
        </Btn>
        <Button
          size="small"
          onClick={() => {
            const url = window.prompt('请输入链接地址');
            if (url) editor.chain().focus().setLink({ href: url }).run();
          }}
        >
          链接
        </Button>
        <Button
          size="small"
          onClick={() => {
            const url = window.prompt('请输入图片地址');
            if (url) editor.chain().focus().setImage({ src: url }).run();
          }}
        >
          图片
        </Button>
      </Space>

      {/* 编辑区 */}
      <div style={{ padding: 12, minHeight: 220 }}>
        <EditorContent editor={editor} />
        {placeholder && !value && (
          <span style={{ color: '#AEAEB2', fontSize: 14 }}>{placeholder}</span>
        )}
      </div>

      {/* 编辑器内容样式（极简、无阴影） */}
      <style>{`
        .暖禾-rte:focus { outline: none; }
        .暖禾-rte p { margin: 0 0 8px; line-height: 1.6; }
        .暖禾-rte h1 { font-size: 20px; font-weight: 600; margin: 12px 0 8px; }
        .暖禾-rte h2 { font-size: 16px; font-weight: 600; margin: 10px 0 6px; }
        .暖禾-rte img { max-width: 100%; border-radius: 8px; }
        .暖禾-rte a { color: #007AFF; }
        .暖禾-rte blockquote { border-left: 3px solid #E5E5EA; margin: 8px 0; padding-left: 12px; color: #6E6E73; }
      `}</style>
    </div>
  );
}
