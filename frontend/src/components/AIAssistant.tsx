import { useEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { streamAiChat, type AiMessage } from '../lib/ai'
import './AIAssistant.css'

type Message = AiMessage & { id: string }

const QUICK_QUESTIONS = ['如何挑选合适的家具？', '不同木材有什么区别？', '小户型如何搭配家具？']

function RobotIcon({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 3v3M8 3h8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <rect x="4" y="6" width="16" height="13" rx="4" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="9" cy="12" r="1.2" fill="currentColor" />
      <circle cx="15" cy="12" r="1.2" fill="currentColor" />
      <path d="M9 15.5h6M2.5 11v3M21.5 11v3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  )
}

export default function AIAssistant() {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight
  }, [messages, busy])

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 100)
  }, [open])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      abortRef.current?.abort()
    }
  }, [])

  const runConversation = async (conversation: Message[]) => {
    const assistantId = crypto.randomUUID()
    const controller = new AbortController()
    abortRef.current = controller
    setBusy(true)
    setError('')
    setMessages([...conversation, { id: assistantId, role: 'assistant', content: '' }])
    let received = false

    try {
      await streamAiChat(
        conversation.slice(-16).map(({ role, content }) => ({ role, content })),
        (delta) => {
          received = true
          setMessages((current) => current.map((message) => (
            message.id === assistantId
              ? { ...message, content: message.content + delta }
              : message
          )))
        },
        controller.signal,
      )
      if (!received) throw new Error('AI 暂未返回内容，请重试')
    } catch (caught) {
      setMessages((current) => current.filter((message) => message.id !== assistantId || message.content))
      if (caught instanceof DOMException && caught.name === 'AbortError') return
      setError(caught instanceof Error ? caught.message : '网络异常，请稍后重试')
    } finally {
      setBusy(false)
      abortRef.current = null
    }
  }

  const send = (text = input) => {
    const content = text.trim()
    if (!content || busy) return
    const conversation = [...messages, { id: crypto.randomUUID(), role: 'user' as const, content }]
    setInput('')
    void runConversation(conversation)
  }

  const retry = () => {
    if (busy) return
    const lastUserIndex = messages.map((message) => message.role).lastIndexOf('user')
    if (lastUserIndex >= 0) void runConversation(messages.slice(0, lastUserIndex + 1))
  }

  const clear = () => {
    abortRef.current?.abort()
    setMessages([])
    setError('')
    setInput('')
  }

  return (
    <>
      {open && (
        <section className="ai-panel" role="dialog" aria-label="暖禾 AI 助手">
          <header className="ai-header">
            <div className="ai-brand-icon"><RobotIcon /></div>
            <div className="ai-header-copy">
              <strong>暖禾 AI 助手</strong>
              <span><i />在线 · 为你解答家居问题</span>
            </div>
            <button className="ai-icon-button" onClick={clear} title="新建会话" aria-label="新建会话">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button className="ai-icon-button" onClick={() => setOpen(false)} aria-label="关闭 AI 助手">
              <svg width="19" height="19" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
          </header>

          <div className="ai-messages" ref={scrollRef} role="log" aria-live="polite">
            {!messages.length && (
              <div className="ai-welcome">
                <div className="ai-welcome-icon"><RobotIcon size={30} /></div>
                <h2>你好，我是暖禾 AI 助手</h2>
                <p>可以和我聊聊家具选购、材质知识与空间搭配。</p>
                <div className="ai-quick-list">
                  {QUICK_QUESTIONS.map((question) => (
                    <button key={question} onClick={() => send(question)}>{question}<span>→</span></button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((message) => (
              <div className={`ai-message ai-message--${message.role}`} key={message.id}>
                {message.role === 'assistant' && <div className="ai-avatar"><RobotIcon size={17} /></div>}
                <div className="ai-bubble">
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <div className="ai-markdown"><ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown></div>
                    ) : <span className="ai-typing"><i /><i /><i /></span>
                  ) : message.content}
                </div>
              </div>
            ))}

            {error && (
              <div className="ai-error" role="alert">
                <span>{error}</span>
                <button onClick={retry}>重试</button>
              </div>
            )}
          </div>

          <footer className="ai-composer-wrap">
            <div className="ai-composer">
              <textarea
                ref={inputRef}
                value={input}
                maxLength={2000}
                rows={1}
                placeholder="输入你的问题…"
                aria-label="输入问题"
                onChange={(event) => setInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                    event.preventDefault()
                    send()
                  }
                }}
              />
              {busy ? (
                <button className="ai-send ai-send--stop" onClick={() => abortRef.current?.abort()} aria-label="停止回答" title="停止回答">
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"><rect x="3" y="3" width="10" height="10" rx="2" /></svg>
                </button>
              ) : (
                <button className="ai-send" disabled={!input.trim()} onClick={() => send()} aria-label="发送问题">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m4 4 17 8-17 8 3-8-3-8Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" /><path d="M7 12h14" stroke="currentColor" strokeWidth="1.8" /></svg>
                </button>
              )}
            </div>
            <p>AI 回答仅供参考，具体产品信息请咨询暖禾工作人员</p>
          </footer>
        </section>
      )}

      <button
        className={`ai-launcher ${open ? 'ai-launcher--open' : ''}`}
        onClick={() => setOpen((value) => !value)}
        aria-label={open ? '收起 AI 助手' : '打开 AI 助手'}
        aria-expanded={open}
      >
        {open ? (
          <svg width="23" height="23" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
        ) : <RobotIcon size={25} />}
        <span>{open ? '收起' : 'AI 助手'}</span>
      </button>
    </>
  )
}
