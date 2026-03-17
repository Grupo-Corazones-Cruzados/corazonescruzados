'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Copy, Check } from 'lucide-react';
import { useState, useCallback } from 'react';

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(() => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [text]);

  return (
    <button
      onClick={copy}
      className="absolute top-2 right-2 p-1 rounded bg-white/10 hover:bg-white/20 text-digi-muted hover:text-digi-text transition-colors"
      title="Copy code"
    >
      {copied ? <Check size={12} /> : <Copy size={12} />}
    </button>
  );
}

export default function MarkdownRenderer({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        code({ className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const codeString = String(children).replace(/\n$/, '');
          const isInline = !match && !codeString.includes('\n');

          if (isInline) {
            return (
              <code
                className="px-1.5 py-0.5 rounded bg-white/10 text-digi-green font-mono text-[11px]"
                {...props}
              >
                {children}
              </code>
            );
          }

          return (
            <div className="relative group my-2">
              {match && (
                <div className="flex items-center justify-between px-3 py-1 bg-white/5 border-b border-white/10 rounded-t text-[10px] text-digi-muted font-mono">
                  {match[1]}
                </div>
              )}
              <CopyButton text={codeString} />
              <SyntaxHighlighter
                style={oneDark}
                language={match?.[1] || 'text'}
                PreTag="div"
                customStyle={{
                  margin: 0,
                  padding: '12px',
                  fontSize: '11px',
                  background: 'rgba(0,0,0,0.3)',
                  borderRadius: match ? '0 0 6px 6px' : '6px',
                }}
              >
                {codeString}
              </SyntaxHighlighter>
            </div>
          );
        },
        table({ children }) {
          return (
            <div className="overflow-x-auto my-2">
              <table className="w-full text-[11px] border-collapse">{children}</table>
            </div>
          );
        },
        thead({ children }) {
          return <thead className="bg-white/5">{children}</thead>;
        },
        th({ children }) {
          return (
            <th className="px-2 py-1.5 text-left font-semibold text-digi-green border border-white/10">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="px-2 py-1.5 border border-white/10">{children}</td>
          );
        },
        h1({ children }) {
          return <h1 className="text-base font-bold text-digi-green mt-3 mb-1">{children}</h1>;
        },
        h2({ children }) {
          return <h2 className="text-sm font-bold text-digi-green mt-3 mb-1">{children}</h2>;
        },
        h3({ children }) {
          return <h3 className="text-xs font-bold text-digi-green mt-2 mb-1">{children}</h3>;
        },
        p({ children }) {
          return <p className="my-1 leading-relaxed">{children}</p>;
        },
        ul({ children }) {
          return <ul className="list-disc list-inside my-1 space-y-0.5">{children}</ul>;
        },
        ol({ children }) {
          return <ol className="list-decimal list-inside my-1 space-y-0.5">{children}</ol>;
        },
        li({ children }) {
          return <li className="leading-relaxed">{children}</li>;
        },
        blockquote({ children }) {
          return (
            <blockquote className="border-l-2 border-digi-green/50 pl-3 my-2 text-digi-muted italic">
              {children}
            </blockquote>
          );
        },
        hr() {
          return <hr className="border-white/10 my-3" />;
        },
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              {children}
            </a>
          );
        },
        strong({ children }) {
          return <strong className="font-bold text-digi-text">{children}</strong>;
        },
        em({ children }) {
          return <em className="italic text-digi-muted">{children}</em>;
        },
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
