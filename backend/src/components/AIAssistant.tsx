import { useEffect, useRef, useState } from 'react';
import { Button, Drawer, message } from 'antd';
import {
  ClearOutlined,
  CopyOutlined,
  PlusOutlined,
  RobotOutlined,
  SendOutlined,
  StopOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { streamAdminAiChat, type AiMessage } from '../lib/ai';
import './AIAssistant.css';

type Message = AiMessage & { id: string };

const QUICK_ACTIONS = [
  '如何发布一个新产品？',
  '帮我写一段实木家具产品卖点',
  '如何润色产品详情和 SEO 简介？',
];

export default function AIAssistant({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, busy]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const runConversation = async (conversation: Message[]) => {
    const assistantId = crypto.randomUUID();
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setError('');
    setMessages([...conversation, { id: assistantId, role: 'assistant', content: '' }]);
    let received = false;

    try {
      await streamAdminAiChat(
        conversation.slice(-16).map(({ role, content }) => ({ role, content })),
        (delta) => {
          received = true;
          setMessages((current) => current.map((item) => (
            item.id === assistantId ? { ...item, content: item.content + delta } : item
          )));
        },
        controller.signal,
      );
      if (!received) throw new Error('AI 暂未返回内容，请重试');
    } catch (caught) {
      setMessages((current) => current.filter((item) => item.id !== assistantId || item.content));
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      setError(caught instanceof Error ? caught.message : '网络异常，请稍后重试');
    } finally {
      setBusy(false);
      abortRef.current = null;
    }
  };

  const send = (text = input) => {
    const content = text.trim();
    if (!content || busy) return;
    const conversation = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content }];
    setInput('');
    void runConversation(conversation);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const retry = () => {
    if (busy) return;
    const lastUserIndex = messages.map((item) => item.role).lastIndexOf('user');
    if (lastUserIndex >= 0) void runConversation(messages.slice(0, lastUserIndex + 1));
  };

  const clear = () => {
    abortRef.current?.abort();
    setMessages([]);
    setError('');
    setInput('');
  };

  const copy = async (content: string) => {
    try {
      await navigator.clipboard.writeText(content);
      void message.success('已复制，可粘贴到编辑表单');
    } catch {
      void message.error('复制失败，请手动选择文本复制');
    }
  };

  return (
    <Drawer
      className="admin-ai-drawer"
      open={open}
      onClose={onClose}
      placement="right"
      width="min(420px, 100vw)"
      mask={false}
      title={
        <div className="admin-ai-title">
          <span className="admin-ai-title-icon"><RobotOutlined /></span>
          <span><strong>AI 工作助手</strong><small>后台指导 · 内容创作</small></span>
        </div>
      }
      extra={
        <Button type="text" icon={<PlusOutlined />} onClick={clear} title="新建会话" aria-label="新建会话" />
      }
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' } }}
    >
      <div className="admin-ai-messages" ref={scrollRef} role="log" aria-live="polite">
        {!messages.length && (
          <div className="admin-ai-welcome">
            <div className="admin-ai-welcome-icon"><RobotOutlined /></div>
            <h3>今天想完成什么工作？</h3>
            <p>我可以指导后台操作，或帮你生成、润色产品内容。</p>
            <div className="admin-ai-quick-list">
              {QUICK_ACTIONS.map((action) => (
                <button key={action} onClick={() => send(action)}>{action}<span>→</span></button>
              ))}
            </div>
          </div>
        )}

        {messages.map((item) => (
          <div className={`admin-ai-message admin-ai-message--${item.role}`} key={item.id}>
            {item.role === 'assistant' && <span className="admin-ai-avatar"><RobotOutlined /></span>}
            <div className="admin-ai-content">
              <div className="admin-ai-bubble">
                {item.role === 'assistant' ? (
                  item.content ? (
                    <div className="admin-ai-markdown">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>{item.content}</ReactMarkdown>
                    </div>
                  ) : <span className="admin-ai-typing"><i /><i /><i /></span>
                ) : item.content}
              </div>
              {item.role === 'assistant' && item.content && (
                <Button
                  className="admin-ai-copy"
                  type="text"
                  size="small"
                  icon={<CopyOutlined />}
                  onClick={() => void copy(item.content)}
                >复制</Button>
              )}
            </div>
          </div>
        ))}

        {error && (
          <div className="admin-ai-error" role="alert">
            <span>{error}</span><Button type="link" size="small" onClick={retry}>重试</Button>
          </div>
        )}
      </div>

      <div className="admin-ai-composer-wrap">
        <div className="admin-ai-composer">
          <textarea
            ref={inputRef}
            value={input}
            rows={2}
            maxLength={2000}
            placeholder="输入后台问题或文案需求…"
            aria-label="输入后台问题或文案需求"
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault();
                send();
              }
            }}
          />
          <Button
            type="primary"
            shape="circle"
            icon={busy ? <StopOutlined /> : <SendOutlined />}
            danger={busy}
            disabled={!busy && !input.trim()}
            onClick={() => (busy ? abortRef.current?.abort() : send())}
            aria-label={busy ? '停止回答' : '发送'}
          />
        </div>
        <div className="admin-ai-footer-note">
          <ClearOutlined /> AI 不会直接修改后台数据，生成内容请核对后使用
        </div>
      </div>
    </Drawer>
  );
}
