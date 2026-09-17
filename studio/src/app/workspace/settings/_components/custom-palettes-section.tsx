"use client";

import { Check, Trash2, Upload } from "lucide-react";
import {
  type ChangeEvent,
  type FormEvent,
  useId,
  useRef,
  useState,
} from "react";
import { toast } from "sonner";
import { usePalette } from "@/components/palette-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  paletteSwatchColor,
  USER_PALETTE_LIMIT,
  useCustomPalettes,
} from "@/lib/custom-palettes";
import {
  type CustomPalette,
  customPaletteId,
  EXAMPLE_PALETTE_DOCUMENT,
  PALETTE_DOCUMENT_MAX_BYTES,
  PALETTE_TOKENS,
} from "@/lib/palette-schema";
import { SettingsCard } from "./settings-card";

function count(n: number, noun: string): string {
  return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

/** `File.text()` where the browser has it, FileReader otherwise. */
function readFileText(file: File): Promise<string> {
  if (typeof file.text === "function") return file.text();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

/**
 * Settings → Personalize → Custom palettes: the web form of mecatui's custom
 * `{name, palette}` JSON themes. A user pastes or uploads a document and it
 * joins the Palette picker at once, stored in this browser only; palettes the
 * operator supplies through `STUDIO_PALETTE_DIR` are listed read-only. The
 * format help is inline (an example document and the token allowlist) so
 * nobody has to guess what the validator wants.
 */
export function CustomPalettesSection() {
  const {
    user,
    operator,
    operatorState,
    operatorError,
    addUserPalette,
    removeUserPalette,
  } = useCustomPalettes();
  const { palette: activePalette, setPalette } = usePalette();
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const textareaId = useId();
  const errorId = useId();
  const fileId = useId();

  function add(document: string): boolean {
    const result = addUserPalette(document);
    if (!result.ok) {
      setError(result.error);
      return false;
    }
    setError(null);
    toast.success(`Added palette "${result.palette.label}"`);
    return true;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (text.trim() === "") {
      setError("Paste a palette document first.");
      return;
    }
    if (add(text)) setText("");
  }

  async function onFile(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > PALETTE_DOCUMENT_MAX_BYTES) {
      setError(
        `${file.name} is larger than ${PALETTE_DOCUMENT_MAX_BYTES / 1024} KiB.`,
      );
    } else {
      add(await readFileText(file));
    }
    // Let the same file be picked again after a fix.
    input.value = "";
  }

  const listed: CustomPalette[] = [...operator, ...user];
  const remaining = USER_PALETTE_LIMIT - user.length;

  return (
    <SettingsCard
      title="Custom palettes"
      description="Add your own colour palettes to the Palette picker above. Stored in this browser; the deployment can also supply palettes with STUDIO_PALETTE_DIR."
    >
      <div className="space-y-5">
        <ul aria-label="Custom palettes" className="divide-y divide-border/60">
          {listed.length === 0 ? (
            <li className="py-2 text-sm text-muted-foreground">
              {operatorState === "loading"
                ? "Checking for operator palettes…"
                : "No custom palettes yet."}
            </li>
          ) : (
            listed.map((palette) => {
              const id = customPaletteId(palette.name);
              const active = activePalette === id;
              return (
                <li
                  key={`${palette.source}:${palette.name}`}
                  className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3 first:pt-0 last:pb-0"
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-4 shrink-0 rounded-full ring-1 ring-border ring-inset"
                    style={{ backgroundColor: paletteSwatchColor(palette) }}
                  />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {palette.label}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {id} · {count(Object.keys(palette.light).length, "token")}
                      {Object.keys(palette.dark).length > 0
                        ? ` · ${count(Object.keys(palette.dark).length, "dark override")}`
                        : ""}
                    </span>
                  </span>
                  <Badge variant={palette.source === "user" ? "muted" : "info"}>
                    {palette.source === "user"
                      ? "this browser"
                      : "operator · read-only"}
                  </Badge>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    disabled={active}
                    aria-label={
                      active
                        ? `${palette.label} is the active palette`
                        : `Use ${palette.label}`
                    }
                    onClick={() => setPalette(id)}
                  >
                    {active ? <Check className="size-4" /> : null}
                    {active ? "In use" : "Use"}
                  </Button>
                  {palette.source === "user" ? (
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-8 rounded-full"
                      aria-label={`Remove ${palette.label}`}
                      title="Remove from this browser"
                      onClick={() => {
                        removeUserPalette(palette.name);
                        toast.success(`Removed palette "${palette.label}"`);
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  ) : null}
                </li>
              );
            })
          )}
        </ul>

        {operatorError ? (
          <p role="status" className="text-xs text-warning">
            {operatorError}
          </p>
        ) : null}

        <form onSubmit={onSubmit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor={textareaId}>Palette document (JSON)</Label>
            <Textarea
              id={textareaId}
              value={text}
              onChange={(event) => {
                setText(event.target.value);
                if (error) setError(null);
              }}
              placeholder='{"name": "midnight", "palette": {"brand": "#4f7cff"}}'
              spellCheck={false}
              rows={6}
              className="font-mono text-xs"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? errorId : undefined}
            />
            {error ? (
              <p id={errorId} role="alert" className="text-xs text-destructive">
                {error}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="submit"
              className="rounded-full"
              disabled={remaining <= 0 && !text.trim()}
            >
              Add palette
            </Button>
            <Button
              type="button"
              variant="outline"
              className="rounded-full"
              onClick={() => fileInput.current?.click()}
            >
              <Upload className="size-4" />
              Upload .json
            </Button>
            <Label htmlFor={fileId} className="sr-only">
              Upload a palette file
            </Label>
            <input
              ref={fileInput}
              id={fileId}
              type="file"
              accept=".json,application/json"
              className="sr-only"
              onChange={onFile}
            />
            <Button
              type="button"
              variant="ghost"
              className="rounded-full"
              onClick={() => {
                setText(EXAMPLE_PALETTE_DOCUMENT);
                setError(null);
              }}
            >
              Insert example
            </Button>
            <span className="text-xs text-muted-foreground">
              {remaining > 0
                ? `${remaining} of ${USER_PALETTE_LIMIT} slots left in this browser.`
                : `All ${USER_PALETTE_LIMIT} slots used — remove a palette to add another.`}
            </span>
          </div>
        </form>

        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer select-none text-sm font-medium text-foreground">
            Document format and allowed tokens
          </summary>
          <div className="mt-2 space-y-3">
            <p>
              A document names the palette and lists the tokens it overrides;
              everything you leave out keeps the current palette&rsquo;s value.
              Add a <code>dark</code> block for values that should differ in
              dark mode — otherwise a token uses the same colour in both.
              Colours may be <code>#hex</code>, <code>rgb()</code>,{" "}
              <code>hsl()</code>, <code>oklch()</code>, <code>oklab()</code> or{" "}
              <code>color()</code>; a document may be up to 8 KiB.
            </p>
            <pre className="overflow-x-auto rounded-md border bg-muted/40 p-3 font-mono text-[11px] leading-snug text-foreground">
              {EXAMPLE_PALETTE_DOCUMENT}
            </pre>
            <ul aria-label="Allowed tokens" className="flex flex-wrap gap-1.5">
              {PALETTE_TOKENS.map((token) => (
                <li key={token}>
                  <Badge variant="outline" className="font-mono">
                    {token}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
        </details>
      </div>
    </SettingsCard>
  );
}
