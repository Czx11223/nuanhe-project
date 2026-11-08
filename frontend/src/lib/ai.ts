export interface AiMessage {
  role: 'user' | 'assistant'
  content: string
}

type StreamEvent =
  | { type: 'delta'; content: string }
  | { type: 'done' }
  | { type: 'error'; message: string }

const API_BASE = (import.meta.env.VITE_API_BASE || '').replace(/\/$/, '')

async function responseError(response: Response): Promise<Error> {
  let message = `请求失败（${response.status}）`
  try {
    const body = await response.json() as { msg?: string }
    if (body.msg) message = body.msg
  } catch {
    // 非 JSON 错误响应使用默认提示
  }
  return new Error(message)
}

/** 读取后端 SSE，并将回答增量交给界面。 */
export async function streamAiChat(
  messages: AiMessage[],
  onDelta: (content: string) => void,
  signal: AbortSignal,
): Promise<void> {
  const response = await fetch(`${API_BASE}/api/ai/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'text/event-stream' },
    body: JSON.stringify({ messages }),
    signal,
  })
  if (!response.ok) throw await responseError(response)
  if (!response.body) throw new Error('当前浏览器不支持流式回答')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  const consume = (rawEvent: string) => {
    const data = rawEvent
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trimStart())
      .join('\n')
    if (!data) return
    const event = JSON.parse(data) as StreamEvent
    if (event.type === 'delta') onDelta(event.content)
    if (event.type === 'error') throw new Error(event.message)
  }

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value || new Uint8Array(), { stream: !done })
    buffer = buffer.replace(/\r\n/g, '\n')
    let boundary = buffer.indexOf('\n\n')
    while (boundary >= 0) {
      consume(buffer.slice(0, boundary))
      buffer = buffer.slice(boundary + 2)
      boundary = buffer.indexOf('\n\n')
    }
    if (done) break
  }
  if (buffer.trim()) consume(buffer)
}
