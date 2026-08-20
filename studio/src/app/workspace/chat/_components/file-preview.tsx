import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  CODE_FILE_EXTENSIONS,
  extensionOf,
  fileKindMeta,
} from "@/lib/file-meta";
import { CodeBlock } from "./code-block";
import { langForExtension } from "./code-highlighter";
import { mdComponents } from "./markdown-components";

/**
 * Renders a file's contents in the right-hand preview panel, choosing how to
 * display it from the file name (the kind classification is shared with the
 * file-kind icons in src/lib/file-meta.ts):
 *
 *  - Images render inline via <img> when a displayable source exists (a `url`
 *    — data: URI or fetchable — or `content` that is itself a data: URI).
 *  - PDFs render in an <iframe> under the same source rule.
 *  - Markdown (`.md`/`.markdown`) is rendered as styled prose, not raw source.
 *  - Recognised source files get the coloured, line-numbered code viewer.
 *  - Everything else (logs, plain text) falls back to monospace pre text.
 */

export type PreviewKind =
  | "image"
  | "pdf"
  | "markdown"
  | "code"
  | "text"
  | "none";

/** A displayable src for binary kinds: the url wins, else a data-URI content. */
function binarySrc(content?: string, url?: string): string | undefined {
  if (url) return url;
  if (content?.startsWith("data:")) return content;
  return undefined;
}

/**
 * The renderer FilePreview will pick for a file, extracted pure so callers
 * (and the mock feature tour's sanity test) can prove a file resolves to a
 * real preview instead of the "No preview available" floor.
 */
export function previewKind(
  name: string,
  content?: string,
  url?: string,
): PreviewKind {
  const label = fileKindMeta(name).label;
  if (label === "Image" && binarySrc(content, url)) return "image";
  if (label === "PDF" && binarySrc(content, url)) return "pdf";
  if (!content) return "none";
  const ext = extensionOf(name);
  if (ext === "md" || ext === "markdown") return "markdown";
  if (CODE_FILE_EXTENSIONS.has(ext)) return "code";
  return "text";
}

export function FilePreview({
  name,
  content,
  url,
}: {
  name: string;
  content?: string;
  url?: string;
}) {
  switch (previewKind(name, content, url)) {
    case "image":
      return (
        <div className="p-4 lg:p-6">
          {/* biome-ignore lint/performance/noImgElement: previews render data URIs and object URLs, not optimizable remote images */}
          <img
            src={binarySrc(content, url)}
            alt={name}
            className="max-w-full rounded-lg"
          />
        </div>
      );
    case "pdf":
      return (
        <iframe
          src={binarySrc(content, url)}
          title={name}
          className="h-full w-full rounded-lg border-0"
        />
      );
    case "markdown":
      return (
        <div className="px-4 py-4 lg:px-6 lg:py-6 text-sm lg:text-[15px] leading-relaxed">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
            {content ?? ""}
          </ReactMarkdown>
        </div>
      );
    case "code":
      return (
        <div className="py-4 lg:py-6">
          <CodeBlock
            code={content ?? ""}
            lang={langForExtension(extensionOf(name))}
          />
        </div>
      );
    case "text":
      return (
        <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed p-4 lg:p-6">
          {content}
        </pre>
      );
    case "none":
      return (
        <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
          <p className="text-sm">No preview available for this file</p>
        </div>
      );
  }
}
