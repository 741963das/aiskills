import ReactMarkdown from 'react-markdown';

interface Props {
  content: string;
  className?: string;
}

/**
 * 统一 Markdown 渲染组件。
 * 用于对话消息、文档预览、Skill 预览等全部 AI 文本输出。
 */
export function MarkdownRenderer({ content, className = '' }: Props) {
  return (
    <div className={'prose prose-sm max-w-none ' + className}>
      <ReactMarkdown
        components={{
          // 标题
          h1: ({ children }) => <h1 className="text-xl font-bold text-gray-900 mt-4 mb-2">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold text-gray-900 mt-3 mb-2">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-semibold text-gray-800 mt-2 mb-1">{children}</h3>,
          // 段落
          p: ({ children }) => <p className="text-sm leading-relaxed text-gray-700 my-1.5">{children}</p>,
          // 列表
          ul: ({ children }) => <ul className="list-disc list-inside text-sm text-gray-700 my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside text-sm text-gray-700 my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="leading-relaxed">{children}</li>,
          // 代码块
          code: ({ inline, children }: any) =>
            inline ? (
              <code className="bg-gray-100 text-pink-600 px-1 py-0.5 rounded text-xs font-mono">{children}</code>
            ) : (
              <pre className="bg-gray-900 text-gray-100 p-3 rounded-lg overflow-x-auto my-2">
                <code className="text-xs font-mono">{children}</code>
              </pre>
            ),
          // 引用
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-indigo-400 pl-3 text-gray-600 italic my-2">{children}</blockquote>
          ),
          // 链接
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-indigo-700 hover:underline">{children}</a>
          ),
          // 表格
          table: ({ children }) => <table className="w-full text-sm border-collapse my-2">{children}</table>,
          th: ({ children }) => <th className="border border-gray-300 bg-gray-50 px-2 py-1 text-left font-semibold">{children}</th>,
          td: ({ children }) => <td className="border border-gray-300 px-2 py-1">{children}</td>,
          // 强调
          strong: ({ children }) => <strong className="font-bold text-gray-900">{children}</strong>,
          em: ({ children }) => <em className="italic">{children}</em>,
          // 分隔线
          hr: () => <hr className="border-gray-200 my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
