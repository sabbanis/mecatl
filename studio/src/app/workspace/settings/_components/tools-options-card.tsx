"use client";

import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useRuntimeStatus } from "@/features/agent/runtime-status";
import {
  capabilityWord,
  DaemonOptionsCard,
  StatusRow,
} from "./daemon-options-card";
import { SettingsRow } from "./settings-card";

/**
 * Settings → Tools: the managed daemon's tool-catalog flags — the Skill
 * tool (`--skills-dir`; off = the flag omitted, which drops the tool) with
 * its directory, and slash-command templates (`--commands-dir` /
 * `--enable-commands`) with theirs — plus the Shell tool's status. The
 * shell-less switch itself (`--no-shell`) stays on Settings → Permissions:
 * one writer per flag.
 *
 * The status rows are the DAEMON's own capability document (`bash`,
 * `skills`, `slash_commands`): what the running daemon registered, in both
 * modes. The controls are managed-mode only and every save restarts the
 * daemon. A directory is a trust decision (a SKILL.md or a command template
 * steers the model like AGENTS.md); the controller confines it to the
 * workspace / default root / mecatl config dir.
 */

export function ToolsOptionsCard() {
  const { serverCapabilities } = useRuntimeStatus();
  return (
    <DaemonOptionsCard
      title="Tools"
      description="Which optional tools the managed daemon registers, and where it discovers skills and slash commands. Changes restart it."
      testId="tools-options"
      confirmTitle="Change the tool catalog and restart the daemon?"
      externalNote={
        <>
          Pass <code>--skills-dir</code>, <code>--commands-dir</code> /{" "}
          <code>--enable-commands</code> or <code>--no-shell</code> to the
          server host&rsquo;s mecated and restart that server.
        </>
      }
      status={
        <>
          <StatusRow
            label="Shell tool"
            testId="tools-status-shell"
            value={capabilityWord(serverCapabilities.bash, {
              on: "registered",
              off: "not registered",
            })}
            description={
              <>
                Shell-less mode is a Permissions setting —{" "}
                <Link
                  href="/workspace/settings/permissions"
                  className="underline underline-offset-2"
                >
                  change it there
                </Link>
                .
              </>
            }
          />
          <StatusRow
            label="Skill tool"
            testId="tools-status-skills"
            value={capabilityWord(serverCapabilities.skills, {
              on: "registered",
              off: "not registered",
            })}
          />
          <StatusRow
            label="Slash commands"
            testId="tools-status-commands"
            value={capabilityWord(serverCapabilities.slash_commands, {
              on: "expanded",
              off: "not expanded",
            })}
          />
        </>
      }
    >
      {({ options, doc, busy, update }) => (
        <div className="divide-y divide-border/60">
          <SettingsRow
            label="Skill tool"
            htmlFor="skill-tool-enabled"
            description="Discover skills (<name>/SKILL.md) from the directory below and register the Skill tool. Off omits --skills-dir, so the daemon loads no skills at all. Never widens to the conventional ~/.claude/skills locations."
          >
            <Switch
              id="skill-tool-enabled"
              checked={options.skills.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => update({ skills: { enabled } })}
            />
          </SettingsRow>
          <SettingsRow
            label="Skills directory"
            htmlFor="skills-dir"
            description="Absolute, or relative to the workspace. Studio's Skills page creates, edits and parks skills in this directory. A trust decision: every SKILL.md here steers the model like AGENTS.md."
          >
            <Input
              id="skills-dir"
              value={options.skills.dir}
              placeholder={doc.defaults.skillsDir}
              disabled={busy || !options.skills.enabled}
              spellCheck={false}
              onChange={(event) =>
                update({ skills: { dir: event.target.value } })
              }
              className="w-56 font-mono text-xs min-[500px]:w-80"
            />
          </SettingsRow>
          <SettingsRow
            label="Slash commands"
            htmlFor="commands-enabled"
            description="Expand /name templates (<name>.md) into prompts. mecated's default is off."
          >
            <Switch
              id="commands-enabled"
              checked={options.commands.enabled}
              disabled={busy}
              onCheckedChange={(enabled) => update({ commands: { enabled } })}
            />
          </SettingsRow>
          <SettingsRow
            label="Commands directory"
            htmlFor="commands-dir"
            description={`Leave empty for mecated's defaults (${doc.defaults.commandDirs.join(", ")}). A trust decision: a template steers the model like a slash command.`}
          >
            <Input
              id="commands-dir"
              value={options.commands.dir}
              placeholder={doc.defaults.commandDirs.join(", ")}
              disabled={busy || !options.commands.enabled}
              spellCheck={false}
              onChange={(event) =>
                update({ commands: { dir: event.target.value } })
              }
              className="w-56 font-mono text-xs min-[500px]:w-80"
            />
          </SettingsRow>
        </div>
      )}
    </DaemonOptionsCard>
  );
}
