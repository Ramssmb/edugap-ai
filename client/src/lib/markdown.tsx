import { Fragment, useState, type ReactNode } from "react";
import { cn } from "./utils";

/**
 * A deliberately small Markdown renderer for lesson text and tutor replies.
 * It builds React elements (never raw HTML), so AI output cannot inject markup.
 * Supports: ## / ### headings, paragraphs, - and 1. lists, **bold**, _italic_,
 * `code`, and ||spoiler|| (click to reveal).
 */

function Spoiler({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      aria-label={open ? undefined : "Reveal answer"}
      className={cn(
        "rounded px-1.5 py-0.5 text-left transition",
        open ? "bg-emerald-50 text-emerald-900" : "cursor-pointer bg-slate-200 text-transparent select-none hover:bg-slate-300",
      )}
    >
      {open ? children : <span className="text-slate-600">Tap to reveal</span>}
    </button>
  );
}

function inline(text: string, keyBase: string): ReactNode[] {
  const out: ReactNode[] = [];
  const re = /(\|\|.+?\|\||\*\*.+?\*\*|`[^`]+`|(?<![A-Za-z0-9])_[^_]+_(?![A-Za-z0-9]))/g;
  let last = 0;
  let m: RegExpExecArray | null;
  let i = 0;
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index));
    const tok = m[0];
    const k = `${keyBase}-${i++}`;
    if (tok.startsWith("||")) out.push(<Spoiler key={k}>{inline(tok.slice(2, -2), k)}</Spoiler>);
    else if (tok.startsWith("**")) out.push(<strong key={k} className="font-semibold text-ink">{inline(tok.slice(2, -2), k)}</strong>);
    else if (tok.startsWith("`")) out.push(<code key={k}>{tok.slice(1, -1)}</code>);
    else out.push(<em key={k}>{inline(tok.slice(1, -1), k)}</em>);
    last = m.index + tok.length;
  }
  if (last < text.length) out.push(text.slice(last));
  return out;
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  const blocks: ReactNode[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let i = 0;
  let key = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) {
      i++;
      continue;
    }
    const k = `b${key++}`;
    const h = /^(#{2,4})\s+(.*)$/.exec(line);
    if (h) {
      const Tag = h[1].length === 2 ? "h2" : "h3";
      blocks.push(<Tag key={k}>{inline(h[2], k)}</Tag>);
      i++;
      continue;
    }
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*[-*]\s+/, ""));
      blocks.push(<ul key={k}>{items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ul>);
      continue;
    }
    if (/^\s*\d+[.)]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+[.)]\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*\d+[.)]\s+/, ""));
      blocks.push(<ol key={k}>{items.map((it, j) => <li key={j}>{inline(it, `${k}-${j}`)}</li>)}</ol>);
      continue;
    }
    // Paragraph: consecutive non-special lines, joined with line breaks.
    const para: string[] = [];
    while (i < lines.length && lines[i].trim() && !/^(#{2,4})\s|^\s*[-*]\s+|^\s*\d+[.)]\s+/.test(lines[i])) para.push(lines[i++]);
    blocks.push(
      <p key={k}>
        {para.map((p, j) => (
          <Fragment key={j}>
            {j > 0 && <br />}
            {inline(p, `${k}-${j}`)}
          </Fragment>
        ))}
      </p>,
    );
  }
  return <div className={className}>{blocks}</div>;
}
