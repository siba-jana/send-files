"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { Check, Copy, Terminal, ExternalLink } from "lucide-react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import oneDark from "react-syntax-highlighter/dist/esm/styles/prism/one-dark.js";
import oneLight from "react-syntax-highlighter/dist/esm/styles/prism/one-light.js";
import { DocumentTheme } from "./types";

interface ChatGptMarkdownRendererProps {
  content: string;
  theme: DocumentTheme;
}

function CodeBlock({
  language,
  value,
  theme = "clean",
}: {
  language: string;
  value: string;
  theme?: DocumentTheme;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const displayLang = language || "code";
  const isDarkTheme = theme === "chatgpt" || theme === "modern";

  return (
    <div
      className={`group relative my-3.5 overflow-hidden rounded-xl border transition-all break-inside-avoid print:shadow-none ${
        isDarkTheme
          ? "border-slate-700/70 bg-[#18181b] text-slate-100 shadow-md print:border-slate-300 print:bg-slate-50 print:text-slate-900"
          : "border-slate-200/90 bg-slate-100/75 dark:bg-slate-900/70 text-slate-900 dark:text-slate-100 shadow-2xs"
      }`}
    >
      {/* Code Block Header (Mac-style terminal dots + lang + copy) */}
      <div
        className={`flex items-center justify-between border-b px-3.5 py-1.5 text-xs ${
          isDarkTheme
            ? "border-slate-800 bg-[#27272a]/90 text-slate-300 print:border-slate-200 print:bg-slate-100 print:text-slate-700"
            : "border-slate-200/80 bg-slate-200/50 dark:border-slate-800 dark:bg-slate-850 text-slate-600 dark:text-slate-300"
        }`}
      >
        <div className="flex items-center gap-2">
          {/* macOS window dots */}
          <div className="flex items-center gap-1.5 print:hidden" aria-hidden="true">
            <span className="size-2.5 rounded-full bg-rose-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-amber-500/80 inline-block" />
            <span className="size-2.5 rounded-full bg-emerald-500/80 inline-block" />
          </div>
          <span className="ml-1 font-mono text-[11px] font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 print:text-slate-700">
            {displayLang}
          </span>
        </div>

        <button
          type="button"
          onClick={handleCopy}
          className={`inline-flex items-center gap-1.5 rounded-md px-2 py-0.5 text-[11px] font-medium transition-colors print:hidden ${
            isDarkTheme
              ? "bg-slate-800/60 border border-slate-700/50 text-slate-300 hover:bg-slate-700 hover:text-white"
              : "bg-white/80 dark:bg-slate-800 border border-slate-300/80 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-white shadow-2xs"
          }`}
          title="Copy code"
        >
          {copied ? (
            <>
              <Check className="size-3 text-emerald-500" />
              <span className="text-emerald-500 font-semibold">Copied</span>
            </>
          ) : (
            <>
              <Copy className="size-3 text-slate-400" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="overflow-x-auto text-[13px] leading-relaxed print:overflow-visible">
        <SyntaxHighlighter
          language={language || "text"}
          style={isDarkTheme ? oneDark : oneLight}
          customStyle={{
            margin: 0,
            padding: "0.85rem 1.15rem",
            fontSize: "0.825rem",
            lineHeight: "1.6",
            background: "transparent",
          }}
          codeTagProps={{
            style: {
              fontFamily:
                "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
            },
          }}
        >
          {value}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function ChatGptMarkdownRenderer({
  content,
  theme,
}: ChatGptMarkdownRendererProps) {
  return (
    <div
      className={`prose-chatgpt w-full text-slate-900 print:text-black ${
        theme === "academic" ? "academic-body font-serif" : ""
      }`}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          h1({ children }) {
            return (
              <h1 className="mt-5 mb-2.5 text-2xl font-bold tracking-tight text-slate-900 border-b border-slate-200/90 pb-2 print:text-black print:border-black/30 break-after-avoid">
                {children}
              </h1>
            );
          },
          h2({ children }) {
            return (
              <h2 className="mt-4 mb-2 text-lg sm:text-xl font-bold tracking-tight text-slate-900 border-b border-slate-100 pb-1.5 print:text-black print:border-black/20 break-after-avoid">
                {children}
              </h2>
            );
          },
          h3({ children }) {
            return (
              <h3 className="mt-3.5 mb-1.5 text-base font-bold tracking-tight text-slate-850 print:text-black break-after-avoid">
                {children}
              </h3>
            );
          },
          h4({ children }) {
            return (
              <h4 className="mt-3 mb-1 text-sm font-semibold text-slate-800 print:text-black break-after-avoid">
                {children}
              </h4>
            );
          },
          p({ children }) {
            return (
              <p className="my-1.5 leading-relaxed text-slate-800 print:text-black text-[14px]">
                {children}
              </p>
            );
          },
          ul({ children }) {
            return (
              <ul className="my-2 list-disc space-y-1 pl-5 text-[14px] text-slate-800 print:text-black marker:text-violet-600 dark:marker:text-violet-400 print:marker:text-black">
                {children}
              </ul>
            );
          },
          ol({ children, start }) {
            return (
              <ol
                start={start}
                className="my-2 list-decimal space-y-1 pl-5 text-[14px] text-slate-800 print:text-black marker:text-violet-600 dark:marker:text-violet-400 print:marker:text-black"
              >
                {children}
              </ol>
            );
          },
          li({ children }) {
            return <li className="leading-relaxed pl-1">{children}</li>;
          },
          blockquote({ children }) {
            return (
              <blockquote className="my-4 rounded-xl border-l-4 border-emerald-500 bg-emerald-50/60 p-4 text-slate-850 shadow-xs print:bg-slate-100 print:border-slate-800 print:text-black break-inside-avoid">
                <div className="text-[14px] leading-relaxed italic">{children}</div>
              </blockquote>
            );
          },
          table({ children }) {
            return (
              <div className="my-5 overflow-x-auto rounded-xl border border-slate-200/90 shadow-xs print:border-slate-400 print:shadow-none break-inside-avoid">
                <table className="w-full border-collapse text-left text-xs sm:text-sm">
                  {children}
                </table>
              </div>
            );
          },
          thead({ children }) {
            return (
              <thead className="bg-slate-100/90 font-semibold text-slate-900 border-b border-slate-200 print:bg-slate-200 print:text-black">
                {children}
              </thead>
            );
          },
          tbody({ children }) {
            return (
              <tbody className="divide-y divide-slate-150 print:divide-slate-300">
                {children}
              </tbody>
            );
          },
          tr({ children }) {
            return (
              <tr className="transition-colors even:bg-slate-50/50 hover:bg-slate-100/40 print:even:bg-slate-100">
                {children}
              </tr>
            );
          },
          th({ children }) {
            return (
              <th className="px-4 py-2.5 font-semibold text-slate-800 print:text-black">
                {children}
              </th>
            );
          },
          td({ children }) {
            return (
              <td className="px-4 py-2.5 text-slate-700 print:text-black">
                {children}
              </td>
            );
          },
          hr() {
            return (
              <hr className="my-3.5 border-t border-slate-200 print:border-slate-400" />
            );
          },
          a({ href, children }) {
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-emerald-600 underline underline-offset-4 hover:text-emerald-700 print:text-black print:no-underline inline-flex items-center gap-0.5"
              >
                <span>{children}</span>
                <ExternalLink className="size-3 inline-block print:hidden" />
              </a>
            );
          },
          strong({ children }) {
            return (
              <strong className="font-semibold text-slate-900 print:text-black">
                {children}
              </strong>
            );
          },
          input({ type, checked }) {
            if (type === "checkbox") {
              return (
                <span
                  className={`inline-flex items-center justify-center size-4 mr-2 rounded border transition-colors align-middle -mt-0.5 ${
                    checked
                      ? "bg-emerald-600 border-emerald-600 text-white"
                      : "border-slate-300 bg-white"
                  }`}
                  aria-hidden="true"
                >
                  {checked && <Check className="size-3 stroke-[3]" />}
                </span>
              );
            }
            return <input type={type} />;
          },
          code({ className, children }) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");

            if (match || codeString.includes("\n")) {
              return (
                <CodeBlock
                  language={match ? match[1] : ""}
                  value={codeString}
                  theme={theme}
                />
              );
            }

            return (
              <code className="rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 font-mono text-[13px] font-medium text-violet-700 dark:text-violet-300 border border-slate-200/80 dark:border-slate-700 print:bg-slate-200 print:text-black">
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
