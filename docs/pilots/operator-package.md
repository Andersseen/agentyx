# Independent operator pilot package

For one person who did not implement the Agentyx change under test. It takes about 30 minutes and
needs Node 22+, pnpm, Git and at least one of Codex, Claude Code or Kimi Code signed in.

## What you test

- Repository: `https://github.com/Andersseen/remove-local-branches`, commit `39bed61`.
- Agentyx: this repository's branch under review, built locally (it is not published yet).

Work only in a temporary directory. Do not push, open pull requests or deploy anything.

## Setup

```sh
export PILOT=$(mktemp -d)
git clone https://github.com/Andersseen/agentyx "$PILOT/agentyx"
git -C "$PILOT/agentyx" switch <branch under review>
pnpm --dir "$PILOT/agentyx" install --frozen-lockfile && pnpm --dir "$PILOT/agentyx" build
alias agentyx="node $PILOT/agentyx/packages/cli/dist/index.mjs"
git clone https://github.com/Andersseen/remove-local-branches "$PILOT/project"
cd "$PILOT/project" && git switch -c pilot 39bed61 && pnpm install --frozen-lockfile
```

## The six workflows

1. **Fresh setup.** `agentyx recommend`, then `agentyx init` (choose packs and your provider), then
   `agentyx sync --dry-run`, `agentyx sync`, `agentyx doctor` and `agentyx resolve --explain`. Note why
   one selected pack fits and whether any optional MCP server was enabled without you selecting it.
2. **Adjustment.** Exclude one Skill you do not need: `agentyx configure --exclude skill:<name> --yes`,
   then `agentyx sync --dry-run` and `agentyx sync`. Check that other Skills remain.
3. **Project fit.** Add to `.agentyx.json`:
   `"context": { "commands": { "typecheck": { "command": "pnpm run check-types", "cwd": "." } }, "constraints": ["Always use braces and strict equality, matching the eslint curly and eqeqeq rules."] }`,
   then `agentyx sync`. Start a **fresh** agent session and ask for a small change in `src/git.ts`
   without mentioning the command or the rule. Note whether the agent runs `pnpm run check-types` and
   follows the rule without a reminder. Discard the change afterwards.
4. **Reproduction.** Commit `.agentyx.json` and `.agentyx.lock.json`. Delete one file under
   `.claude/skills` or `.agents/skills` that Agentyx wrote, run `agentyx install --frozen`, then
   `git status` (the lock must be unchanged) and `agentyx doctor --locked --check`.
5. **Conflict recovery.** Add a line to one Agentyx-written `SKILL.md`, run `agentyx sync`, and read
   the message. Confirm your line survived. Recover the way the message suggests, without `--force`.
6. **Removal.** Before uninstalling, add a Skill of your own (`.claude/skills/mine/SKILL.md`) and an
   MCP server of your own to `.mcp.json`. Run `agentyx uninstall` and confirm both are still there.

## Share only this

Do not share prompts, transcripts, source code, tokens or anything from your home directory.

```text
Operator (name or handle):            Date:
OS / Node / pnpm:                     Agentyx commit:
Provider and version:
Packs and targets chosen:
1 Fresh setup:        pass / fail     help needed? confusion?
2 Adjustment:         pass / fail     help needed? confusion?
3 Project fit:        command run without reminder? yes / no   rule followed? yes / no / unclear
4 Reproduction:       restored? lock unchanged? locked Doctor exit code:
5 Conflict recovery:  edit survived? message understandable? how you recovered:
6 Removal:            your Skill and MCP server kept? yes / no
Did the provider list or use an installed Skill? observed / not observed / unknown
Anything that surprised you:
```
