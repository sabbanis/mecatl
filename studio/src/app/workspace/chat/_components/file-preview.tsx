import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { CodeBlock } from "./code-block";
import { langForExtension } from "./code-highlighter";
import { mdComponents } from "./markdown-components";

/**
 * Renders a file's contents in the right-hand preview panel, choosing how to
 * display it from the file name:
 *
 *  - Markdown (`.md`/`.markdown`) is rendered as styled prose, not raw source.
 *  - Recognised source files get the coloured, line-numbered code viewer.
 *  - Everything else (logs, plain text) falls back to monospace pre text.
 */

const CODE_EXTENSIONS = new Set([
  "ts",
  "tsx",
  "js",
  "jsx",
  "mjs",
  "cjs",
  "json",
  "py",
  "sh",
  "bash",
  "zsh",
  "go",
  "rs",
  "java",
  "rb",
  "php",
  "c",
  "cpp",
  "h",
  "hpp",
  "cs",
  "kt",
  "swift",
  "yml",
  "yaml",
  "toml",
  "sql",
  "css",
  "scss",
  "html",
  "xml",
  "graphql",
  "prisma",
]);

function extensionOf(name: string): string {
  const dot = name.lastIndexOf(".");
  return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
}

export function FilePreview({
  name,
  content,
}: {
  name: string;
  content?: string;
}) {
  if (!content) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
        <p className="text-sm">No preview available for this file</p>
      </div>
    );
  }

  const ext = extensionOf(name);

  if (ext === "md" || ext === "markdown") {
    return (
      <div className="px-4 py-4 lg:px-6 lg:py-6 text-sm lg:text-[15px] leading-relaxed">
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
          {content}
        </ReactMarkdown>
      </div>
    );
  }

  if (CODE_EXTENSIONS.has(ext)) {
    return (
      <div className="py-4 lg:py-6">
        <CodeBlock code={content} lang={langForExtension(ext)} />
      </div>
    );
  }

  return (
    <pre className="whitespace-pre-wrap font-mono text-xs leading-relaxed p-4 lg:p-6">
      {content}
    </pre>
  );
}
