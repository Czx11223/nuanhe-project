interface Props {
  /** 点击「重新加载」时触发（一般是递增 reload 计数器重新执行 useEffect） */
  onRetry: () => void
  /** 传给外层栅格容器的类名，默认占满整行 */
  className?: string
}

// 列表加载失败态：此前各页面 catch 里直接 setList([])，用户看到的是「暂无数据」，
// 无法区分「真的没内容」和「接口挂了」。这里给出明确提示与重试入口。
// 请求层（lib/request.ts）仍会弹出 toast，本组件负责页面内的持久状态。
export default function ErrorState({ onRetry, className = 'col-span-full text-center py-12' }: Props) {
  return (
    <div className={className}>
      <p className="text-gray-500">内容加载失败，请稍后重试</p>
      <button
        type="button"
        onClick={onRetry}
        className="mt-3 px-4 py-2 rounded-lg text-sm border border-brand text-brand hover:bg-brand hover:text-white transition"
      >
        重新加载
      </button>
    </div>
  )
}
