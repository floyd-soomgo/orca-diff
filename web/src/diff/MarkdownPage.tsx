import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import rehypeHighlight from 'rehype-highlight';
import { markMarkdownChanges } from './markdownChanges.ts';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownPage({ text, label, changes }: { text: string; label?: string; changes?: Set<number> }) {
  return <section className="markdown-page">
    {label && <div className="panel-title">{label}</div>}
    <article className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw, rehypeSanitize, rehypeHighlight, [markMarkdownChanges, changes]]} components={{
        a: ({ href, children }) => href && /^https?:\/\//i.test(href)
          ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>,
        img: ({ src, alt }) => typeof src === 'string' && /^https?:\/\//i.test(src)
          ? <img src={src} alt={alt ?? ''} referrerPolicy="no-referrer" loading="lazy" /> : <span>{alt || src}</span>,
      }}>{text}</Markdown>
    </article>
  </section>;
}
