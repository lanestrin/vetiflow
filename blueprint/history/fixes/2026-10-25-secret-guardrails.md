# Fix: Secret guardrails

- **Type:** Fix
- **Status:** complete
- **Branch:** `fix/secret-guardrails`
- **Audit:** required - changes workflow safety checks and a hard rule in `CLAUDE.md` (secrets); the user also asked for a separate-session review for this kind of work

## The problem

Nothing in the repo stops Claude from reading or printing secrets; the only
protection is prose, and some of that prose tells Claude to expose them.

1. **No shared permission rules.** There is no `.claude/settings.json`, so no
   `Read`/`Edit` deny rules exist for `.env` files. A real
   `vetiflow.client/.env.local` exists today, ignored by git but readable by
   Claude's file tools.
2. **Instructions that expose connection strings.**
   `.claude/skills/migration/SKILL.md:43-44` says to run
   `dotnet user-secrets list`; `CLAUDE.md:20` and
   `.claude/skills/check/SKILL.md:37` say "Check the connection string first"
   with no safe way to do it. On 2026-10-25 `/check` ran
   `dotnet user-secrets list` (password masked by `sed`), which printed the host,
   database and user and passed the full value through the tool.
3. **No guard against secret-listing commands.** `printenv`, `env`,
   `Get-ChildItem env:` and `dotnet user-secrets list` run without any check.
4. **Docker build context is unfiltered.** `vetiflow.Server/Dockerfile` does
   `COPY . ./` with no `.dockerignore`, so `bin/`, `obj/`,
   `appsettings.Development.json` and `vetiflow.Server.csproj.user` go into the
   build context, and any `.env` file placed there later would too.

## What this can and cannot enforce

Stated up front, because the instructions and reports must not overclaim:

| Control | Enforced by | Covers | Does not cover |
| --- | --- | --- | --- |
| `Read`/`Edit` deny rules | Claude Code | Claude's file tools, `@` mentions, IDE context, commands Claude Code recognises in Bash/PowerShell (`cat`, `head`, `sed`, `Get-Content` ...) and `<`/`>` redirect targets | `grep -r .` from the folder, and any script (`node`, `python`, `dotnet`) that opens files itself |
| Bash/PowerShell deny rules + PreToolUse hook | Claude Code, by matching the command text | the listed secret-dumping commands and commands that name a `.env` file, including inside `sh -c` (hook) | anything that does not name them: a script that reads `process.env`, an alias, an encoded command. With `onFailure: "block"`, a hook that can't start, crashes or times out blocks the call (Claude Code v2.1.295+; 2.1.304 installed) |
| `db-target.ps1 -Migrate` / `-StartApp` | the script | the operation it starts uses exactly the checked string | `dotnet ef` or `dotnet run` started directly (advisory rule) |
| `.gitignore`, `.dockerignore` | git, Docker | commits and image build context | Claude's access to the files |
| `CLAUDE.md`, skills | nothing (advisory) | what Claude tries | any boundary |

**OS-level isolation is not available on this machine as set up.** The Claude
Code sandbox, which applies deny rules to every subprocess, runs on macOS,
Linux and WSL2 only; on native Windows commands run unsandboxed. Meeting
"Claude cannot access these files" needs a separate setup step (below), not a
repo change.

## The fix

- **`.claude/settings.json` (shared, committed):**
  - `permissions.deny`: `Read(.env)`, `Read(.env.*)`, `Edit(.env)`,
    `Edit(.env.*)` (bare names match at any depth), then the carve-out
    `Read(!.env.example)` / `Edit(!.env.example)` so the committed example stays
    usable; `Read`/`Edit` of the user-secrets folders
    (`~/AppData/Roaming/Microsoft/UserSecrets/**` on Windows,
    `~/.microsoft/usersecrets/**` on Linux/WSL);
    `Bash(dotnet user-secrets list*)`, `PowerShell(dotnet user-secrets list*)`,
    `Bash(printenv*)`, `Bash(env)`, `PowerShell(Get-ChildItem env:*)`.
  - `hooks.PreToolUse` for `Bash|PowerShell`: runs
    `.claude/hooks/block-secret-commands.mjs` with `node` (exec form), so the
    same hook works on native Windows and in WSL2. It reads the hook JSON from
    stdin and exits 2 with a one-line reason when the command lists secret
    values or names a `.env` file other than `.env.example`, and also when the
    input can't be read or has no string command. It never echoes the command
    or any value. The entry sets `"onFailure": "block"` and `"timeout": 10`, so
    a missing `node` or script, a crash or a timeout blocks the call (step 6).
- **`scripts/db-target.ps1`:** resolves the connection string the way the app
  does (env var `ConnectionStrings__VetiFlowDatabase`, then user secrets, then
  `appsettings.Development.json`, then `appsettings.json`; stops at the first
  found), or `VETIFLOW_TEST_POSTGRES` with `-Tests`. Prints only
  `Database target: local` (exit 0), `Database target: NOT local` (exit 1) or
  `Database target: not configured` (exit 2). Never prints the host, user,
  database name or password. "Local" means `localhost`, `127.0.0.1`, `::1` or
  `host.docker.internal`.
- **Replace the three instructions:** `CLAUDE.md:20`, `check/SKILL.md:37` and
  `migration/SKILL.md:43-44` say to run `scripts/db-target.ps1` and stop unless
  it says `local`. Add the secret rules (no `.env` reads, no secret-listing
  commands, fixtures only for testing protections) to the `CLAUDE.md` hard
  rules and the Safety section of `ai-interaction.md`, with the coverage table's
  limits in one sentence.
- **`vetiflow.Server/.dockerignore`:** `bin/`, `obj/`, `*.user`, `.env`,
  `.env.*`, `appsettings.*.local.json`, `**/secrets.json`.
- **Regression checks:** `scripts/tests/secret-guardrails.tests.ps1`, plain
  PowerShell (no Pester), run by Verify as a new `Workflow tests` step:
  - the hook blocks sample command strings (`dotnet user-secrets list`,
    `printenv`, `env`, `gci env:`, `cat vetiflow.client/.env.local`,
    `sh -c "printenv"`) and allows `git status`, `cat .env.example`,
    `dotnet test`. The strings are only passed to the hook as JSON; nothing is
    executed.
  - `db-target.ps1` with fake connection strings in its own process
    (`Host=localhost;Password=fixture-pw`, `Host=db.example.invalid;Password=fixture-pw`):
    right line and exit code, and the output never contains
    `example.invalid` or `fixture-pw`. The env var is found first, so the real
    user secrets are never opened.
  - `settings.json` contains each required deny rule and the hook;
    `.dockerignore` contains the required entries.

Must not break: Verify on Windows PowerShell 5.1 and pwsh, `-ServerOnly` and
`-ClientOnly` (the new step runs in both), `dotnet ef` and the app's own
configuration loading, and reading `.env.example`.

Out of scope: verification evidence and mode validation (slice B), CI (slice
C), S.10's secret scanning and rotation note.

## Separate setup step (yours, not in this branch)

For OS-level isolation, run Claude Code inside WSL2 with the sandbox on:
install WSL2 and a distro, clone the repo inside the WSL filesystem, install
the .NET SDK, Node and Docker integration there, and add
`"sandbox": { "enabled": true, "failIfUnavailable": true }` in your user
settings in WSL. Keep real credentials out of that environment: the local
database uses a disposable `postgres` password, and hosted connection strings
live only in Render and Vercel. The history file will carry these steps; this
branch does not change your environment.

## Build steps

- [x] **Step 1 - regression checks first.** Write
  `scripts/tests/secret-guardrails.tests.ps1` and the `Workflow tests` step in
  Verify. *Done when:* the step runs and fails because the hook, script, rules
  and `.dockerignore` do not exist yet.
- [x] **Step 2 - settings and hook.** Add `.claude/settings.json` and
  `.claude/hooks/block-secret-commands.ps1`. *Done when:* the hook and settings
  checks in the test file pass.
- [x] **Step 3 - safe target check.** Add `scripts/db-target.ps1` and replace the
  three instructions. *Done when:* the db-target checks pass, and
  `grep -rn "user-secrets list\|Check the connection string" CLAUDE.md .claude blueprint/context`
  finds only the deny rules and the new hard rule that forbids the command
  (run it with the Grep tool: the hook blocks a shell search whose text names
  the command).
- [x] **Step 4 - Docker context and docs.** Add `.dockerignore`; update the
  hard rules, `ai-interaction.md` Safety, and the verify skill's step list.
  *Done when:* the `.dockerignore` check passes and Verify shows
  `PASS  Workflow tests`.

- [x] **Step 5 - repair audit findings F-09 to F-14.** Rewrite the hook in
  Node (fails closed on bad input), covering the missed forms: `user-secrets`
  with options before `list`, `env` as a command word in any position or path
  form, any `Env:` drive reference except `$env:NAME`, bare `set`, `export`,
  `declare -x/-p`, `compgen -e`, `cmd /c set`, and `.env` globs and brace lists
  (only an exact `.env.example` is allowed). `db-target.ps1` uses the last
  `Host`/`Server` key and drops the URI branch. Tests add each missed form,
  both duplicate-key cases, source precedence with a fake `APPDATA` in TEMP,
  `-Tests` with the variable unset, and the `Edit(!.env.example)` order. Docs
  name the fail-open case. *Done when:* the guardrail checks pass with the new
  cases, Verify passes, and F-09 to F-14 are marked `fixed`.
- [x] **Step 6 - repair review findings F-15 to F-19.**
  - `db-target.ps1` parses with `System.Data.Common.DbConnectionStringBuilder`
    (the ADO.NET quoting rules Npgsql's builder inherits; Npgsql itself can't
    load in Windows PowerShell 5.1). Every `Host`/`Server` value, and every host
    in a comma list, must be local; a malformed string is NOT local.
  - New `-Migrate` and `-StartApp` switches validate the string, then run
    `dotnet ef database update --project vetiflow.Server` or
    `dotnet run --project vetiflow.Server --launch-profile https` with that exact
    string bound in the child's `ConnectionStrings__VetiFlowDatabase`, competing
    variables removed, and no connection string on the command line.
    *Changed during the build:* the first version passed `--connection` and a
    `--ConnectionStrings:...` argument, but a native probe showed Windows
    PowerShell 5.1 strips embedded quotes from native arguments, turning
    `Password="x;Host=remote"` into a real `Host=remote`. `-StartApp` also
    refuses an `https` launch profile that sets a connection string, since
    `dotnet run` applies it after ours. NOT local or not configured runs
    nothing. A test-only `-Dotnet` parameter points at a fake that records its
    arguments and environment, so tests never touch a database. `CLAUDE.md`, `/migration` and
    `/check` allow migrations and app starts only through these switches; the
    plain check authorizes nothing by itself.
  - The hook entry gets `"onFailure": "block"` and `"timeout": 10`; docs stop
    calling fail-open unavoidable.
  - The hook blocks a Bash or PowerShell event whose `command` is missing, null
    or not a string.
  - `scripts/tests/integration/new-fixture.ps1` and `remove-fixture.ps1` create
    and remove harmless fixtures: fake-content dotfiles in
    `scripts/tests/fixtures/`, a synthetic project in TEMP with a new random
    `UserSecretsId` and no secrets, and (only when
    `.claude/settings.local.json` doesn't exist) probe hooks for a missing
    script, a crash and a timeout, scoped with `if` to harmless `echo` probes.
    The Verify section lists the integration steps and keeps three kinds of
    evidence apart.
  *Done when:* the guardrail checks pass with the new cases (quoted semicolon,
  duplicate keys, malformed, multiple hosts, `-Migrate`/`-StartApp` argument
  binding and refusal, malformed events, `onFailure` in settings, fixture
  scripts harmless and repeatable), full Verify passes once, and F-15 to F-19
  are marked `fixed`.

- [x] **Step 7 - repair review findings F-20 and F-21.**
  - `-StartApp` runs `dotnet run --project vetiflow.Server --no-launch-profile`
    and sets `ASPNETCORE_ENVIRONMENT=Development` and
    `ASPNETCORE_URLS=https://localhost:7274;http://localhost:5112` in the
    child's environment, in place of the `https` profile. No profile means
    no profile `commandLineArgs` or `environmentVariables`, so the exit-4
    profile check is removed. The script's help text says why; no rule or skill
    named the profile, so none changed.
  - `new-fixture.ps1` and `remove-fixture.ps1` find the repo root three levels
    up from their folder; the `-RepoRoot` parameter goes.
  *Done when:* the guardrail checks cover the `-StartApp` arguments and
  environment, a profile with remote `commandLineArgs` and `environmentVariables`
  that changes nothing, and the fixture scripts run from a copied repo layout
  in TEMP with no root argument; full Verify passes; F-20 and F-21 are marked
  `fixed`. *Also checked by hand:* a synthetic app whose profile names
  `db.example.invalid` in both `commandLineArgs` and `environmentVariables` saw
  the remote target under `--launch-profile https` and the checked local one
  through `db-target.ps1 -StartApp`.

- [x] **Step 8 - repair audit findings F-22 to F-24.**
  - Hook: `env` followed only by `NAME=value` words (quoted values included)
    up to the end or a separator counts as listing, like `env` with options.
    `start` also accepts the prefix words `nohup`, `command`, `builtin`,
    `nice`, `if`, `while`, `until`, `!` and `timeout <n>`.
  - Hook: command text that names a known secret variable is blocked:
    `ConnectionStrings__` or `ConnectionStrings:`, `CONNSTR_`,
    `VETIFLOW_TEST_POSTGRES`, and `/proc/<anything>/environ`. `db-target.ps1`
    reads these inside the script, which the hook never sees. The
    ai-interaction table's hook row names them among what the hook blocks.
  - `db-target.ps1 -Migrate` / `-StartApp`: save every environment variable
    they set or remove, and restore them in a `finally` after the child exits,
    so a caller that runs the script with `&` gets its environment back
    unchanged.
  *Done when:* the guardrail checks block `env FOO=1`, `env FOO=1 | sort`,
  `env FOO="a b"`, `nohup env`, `command env`, `builtin export`,
  `timeout 5 env`, `! env`, `if env; then :; fi`, a `$env:` read of the
  connection-string variable, `echo $VETIFLOW_TEST_POSTGRES`, a `CONNSTR_`
  variable and `cat /proc/self/environ`; still allow
  `env NODE_ENV=test npm run build`, `nohup npm run dev`, `command -v node`,
  `timeout 5 npm test` and `if true; then echo ok; fi`; a caller that runs
  `-Migrate` and `-StartApp` with `&` (fixture project, fake dotnet) has no
  connection-string variable afterwards, its competing variable and
  `ASPNETCORE_ENVIRONMENT` unchanged; full Verify passes; F-22 to F-24 are
  marked `fixed`.

## Verify

Three kinds of evidence, kept apart; none proves another.

1. **Direct script tests** (`scripts/tests/secret-guardrails.tests.ps1`, the
   Verify step `Workflow tests`): run the hook and `db-target.ps1` as processes
   with synthetic input. They prove what the scripts do, not that Claude Code
   calls them.
2. **Settings-string assertions** (same file): the deny rules, carve-outs, hook
   entry, `onFailure` and `timeout` are present in `.claude/settings.json`.
   They prove what the file says, not how Claude Code applies it.
3. **Integration through Claude Code's permission engine** (`/check`, in a new
   session): only with the harmless fixtures. Every command below stays
   harmless if every rule and hook fails: it can only show fake content, an
   empty synthetic secret store or a cleared environment.

`/check` steps:

1. `powershell -ExecutionPolicy Bypass -File scripts/tests/integration/new-fixture.ps1`
   (adds the probe hooks only if `.claude/settings.local.json` doesn't exist).
   Start the new session after this so the probe hooks load.
2. Read tool on `scripts/tests/fixtures/.env.fixture`: denied.
3. Bash `cat scripts/tests/fixtures/.env.fixture`: denied or blocked.
4. Read tool on `scripts/tests/fixtures/.env.example`: shows
   `FIXTURE_ONLY=not-a-secret`.
5. Bash `dotnet user-secrets list --project <synthetic project path printed in step 1>`:
   blocked. The synthetic project's random `UserSecretsId` has no secrets.
6. Bash `env -i FIXTURE_ONLY=not-a-secret /usr/bin/printenv`: blocked. If it
   ran, it could only print that one fake variable.
7. Bash `echo onfailure-missing-script`, `echo onfailure-missing-exe`,
   `echo onfailure-crash`, `echo onfailure-timeout`: each blocked with
   `failed; blocking because onFailure is "block"` (or `timed out`). This proves
   Claude Code honours `onFailure` for those failure kinds, using probe hooks
   with the same fields; it doesn't break the real hook's `node` to prove it.
8. `powershell -ExecutionPolicy Bypass -File scripts/tests/integration/remove-fixture.ps1`.

Never test against the real project's secret store, a real `.env` file or the
real process environment.

Also: `powershell -ExecutionPolicy Bypass -File scripts/verify.ps1` passes once
after the build stabilizes, every step PASS and exit 0.

Until slice B adds evidence reuse, these current rules repeat verification and
are followed as written, not skipped: `/complete` gate 3 always reruns the full
Verify; `/audit` in a new session reruns it (it can only reuse a pass seen in
the same session); `/approve` check 3 reruns it when any file outside
`blueprint/` is newer than `landing-commit.txt`.

## Findings

Four review rounds on 2026-10-25: a subagent review (F-09 to F-14), the
person's own review (F-15 to F-21) and two `/audit` runs (F-22 to F-24, then
F-25). F-09 to F-24 are closed; the person accepted F-25 as a known limit
(P3).

### F-09 [P2] closed - Hook misses common forms of the commands it lists
**Where:** `.claude/hooks/block-secret-commands.ps1:25-33`
**Problem:** Probed by passing strings to the hook (exit 0 = allowed): `dotnet user-secrets --project vetiflow.Server list` and `-p ... list` (options before `list`, the same command as the 2026-10-25 incident), `env -u FOO`, `env -0`, `env > out.txt`, `{ env; }`, `` `env` ``, `/usr/bin/env`, `Get-ChildItem -Path Env:`, `Get-Item -Path Env:*`, `cmd /c set`, and bash `set`, `export`, `declare -x`, `compgen -e` are all allowed. The deny rules do not cover them either (`Bash(env)` is exact; `PowerShell(Get-ChildItem env:*)` needs `env:` straight after the cmdlet). `CLAUDE.md` says "a hook blocks the commands" and the spec says it covers "the listed secret-dumping commands", but these are the listed commands in ordinary forms.
**Fix:** match `user-secrets\b.*\blist\b`; treat `env` followed by flags or a redirect as listing (allow only `env NAME=value cmd`); allow `{`, backtick and `/` before `env`; match `-Path` / `-LiteralPath` before `env:`; add `cmd /c set`, bare `set`, bare `export`, `declare -x|-p`, `compgen -e`. Add each as a blocked case in the test file. Say in the ai-interaction hook row that other spellings of these commands are not covered.

### F-10 [P2] closed - db-target says `local` when a later Host/Server key points elsewhere
**Where:** `scripts/db-target.ps1:67`
**Problem:** The regex takes the first `Host`/`Server` key. Npgsql treats `Server` as a synonym of `Host` and the last occurrence wins, so `Host=localhost;Server=db.example.invalid` and `Host=localhost;...;Host=db.example.invalid` both print `Database target: local` (exit 0, probed with fake values) while the app would connect to the remote host. This is the one unsafe direction for the migration gate.
**Fix:** use the last `host|server` match (or report `NOT local` when there is more than one); add both strings as `NOT local` cases.

### F-11 [P2] closed - Hook fails open, silently, outside native Windows and on script errors
**Where:** `.claude/settings.json:29-35`, `.claude/hooks/block-secret-commands.ps1:20-23`
**Problem:** The spec's own setup step recommends running Claude Code in WSL2. There `powershell.exe` is either absent or the Windows binary, which cannot open the Linux `${CLAUDE_PROJECT_DIR}` path; both end as a non-blocking hook error, so every command runs unchecked with no warning. Inside the script, unreadable input exits 0 and any other exception exits 1, which Claude Code also treats as non-blocking (confirmed: hook JSON with `command` and `Command` keys makes 5.1's `ConvertFrom-Json` throw, exit 0). The docs present the hook as a control without saying it fails open.
**Fix:** on non-Windows run the same script with `pwsh` (second hook entry, or a small launcher that picks `pwsh` then `powershell.exe`), and state in the ai-interaction table that the hook needs PowerShell and fails open when it cannot run. Consider exit 2 when input cannot be parsed.

### F-12 [P3] closed - `.env` pattern misses globs and braces
**Where:** `.claude/hooks/block-secret-commands.ps1:35`
**Problem:** `cat vetiflow.client/.env*`, `cat vetiflow.client/.env.l*` and `cat vetiflow.client/{.env.local,x}` are allowed, because `*`, `,`, `{` and `}` are not in the boundary sets. `.env.example.bak` is also treated as the example (the lookahead is `\.example\b`).
**Fix:** add `*?[]{},` and backtick to the boundary sets, and make the carve-out `\.example(?=$|[\s'";|&)>])`. Add the glob case to the tests.

### F-13 [P3] closed - Tests do not cover the precedence order or two edge paths
**Where:** `scripts/tests/secret-guardrails.tests.ps1:95-132,151-153`
**Problem:** Only "env var first" and "Development json when nothing else" are checked. Nothing proves user secrets beat `appsettings.Development.json` or that Development beats `appsettings.json` (both checkable with a fake `APPDATA` and a fixture csproj with a `UserSecretsId`, all in TEMP). `-Tests` with `VETIFLOW_TEST_POSTGRES` unset, and the `Edit(!.env.example)` ordering, are not checked.
**Fix:** add those fixture cases.

### F-14 [P3] closed - URI branch in db-target is speculative and mis-reads IPv6
**Where:** `scripts/db-target.ps1:63-64`
**Problem:** Npgsql does not accept `postgres://` URIs as a connection string, so the app cannot use one; the branch is untested. `[uri]` also expands `[::1]` to `[0000:...:0001]`, so a loopback IPv6 URI reports `NOT local` (safe direction).
**Fix:** drop the URI branch (any URI then reports `NOT local` since it has no `Host=`), or keep it and add tests.

### F-15 [P1] closed - db-target reads a Host from inside a quoted value
**Where:** `scripts/db-target.ps1` (`Test-LocalTarget` regex)
**Problem:** From the person's review, reproduced with a synthetic value: `Host=db.example.invalid;Password="fixture;Host=localhost;marker";Database=fixture` prints `Database target: local`, exit 0. The regex splits on `;` inside the quoted password, so the migration gate passes for a remote database.
**Fix:** parse with `DbConnectionStringBuilder` (the ADO.NET parser Npgsql's builder inherits; Npgsql itself can't load in Windows PowerShell 5.1); every `Host`/`Server` value must be local; malformed strings are NOT local. Tests for quoted semicolons, duplicate keys, malformed strings, multiple hosts.

### F-16 [P1] closed - A passing check does not bind the operation that follows
**Where:** `scripts/db-target.ps1`, `CLAUDE.md` hard rule, `/migration` step 4, `/check` step 2
**Problem:** From the person's review. The check reads user secrets and `appsettings.Development.json`, but `dotnet ef` or the app can then use another environment, launch-profile variables or command-line overrides, so "local" from the check can authorize an operation against a different target.
**Fix:** `db-target.ps1 -Migrate` and `-StartApp` validate and then bind the same string for the child in `ConnectionStrings__VetiFlowDatabase`, with competing variables removed and nothing on the command line. (The first version used `--connection` and a command-line argument; Windows PowerShell 5.1 strips embedded quotes from native arguments, so the spec's Step 6 changed it.) Rules and skills allow migrations and app starts against a database only through them.

### F-17 [P2] closed - Hook still fails open when it cannot run
**Where:** `.claude/settings.json`, docs that call fail-open unavoidable
**Problem:** From the person's review. Claude Code 2.1.304 is installed, and `onFailure: "block"` (v2.1.295+) makes a missing executable, missing script, exit code other than 0 or 2 (a crash) or a timeout block the call. The hook entry doesn't set it, and the docs present fail-open as unavoidable.
**Fix:** add `"onFailure": "block"` and a short `timeout`; correct the docs; a settings assertion plus integration probes for each failure kind.

### F-18 [P2] closed - Hook allows matching events with no string command
**Where:** `.claude/hooks/block-secret-commands.mjs` (`typeof command !== 'string'` exits 0)
**Problem:** From the person's review. A Bash or PowerShell event with a missing, null or non-string `command` is allowed.
**Fix:** block it; tests for missing, null, number and object.

### F-19 [P2] closed - Integration checks are not harmless if protection fails
**Where:** spec Verify section (the `/check` plan)
**Problem:** From the person's review. The planned `/check` would run the user-secrets listing command against the real project with no isolated fixture, so a failed rule or hook would expose real values. The spec also doesn't separate direct script tests and settings-string assertions from checks through Claude Code's permission engine.
**Fix:** fixture scripts that create a synthetic project (new random `UserSecretsId`, no real secrets), fake dotfile fixtures, and an isolated environment for env-dump probes; an integration procedure whose every command stays harmless even if all protections fail; the three kinds of evidence named separately.

### F-20 [P1] closed - Launch-profile arguments can still override the checked database
**Where:** `scripts/db-target.ps1:142-161` (`-StartApp`)
**Problem:** From the person's review, reproduced with a synthetic app that never connects to a database: the wrapper printed `Database target: local`, the app saw the remote target, exit 0. `-StartApp` runs `dotnet run --launch-profile https` and checks only the profile's `environmentVariables`. A `commandLineArgs` entry such as `--ConnectionStrings:VetiFlowDatabase=Host=db.example.invalid` reaches the app as a command-line argument, which beats the bound environment variable.
**Fix:** run `dotnet run --no-launch-profile`, and set the settings the profile supplied (`ASPNETCORE_ENVIRONMENT=Development` and the `https` URLs) in the child's environment. With no profile loaded, neither its arguments nor its variables apply, so the separate profile check goes. Tests: the arguments are exactly `run --project <dir> --no-launch-profile`, the environment and URLs reach the child, and a profile with remote `commandLineArgs` and `environmentVariables` changes nothing.

### F-21 [P2] closed - Integration-fixture scripts default to the wrong repository root
**Where:** `scripts/tests/integration/new-fixture.ps1:23`, `scripts/tests/integration/remove-fixture.ps1:8`
**Problem:** From the person's review. The default `-RepoRoot` climbs two levels from `scripts/tests/integration`, giving `scripts/`. The documented commands therefore write fixtures to `scripts/scripts/tests/fixtures` and probe hooks to `scripts/.claude`, which a session started at the repo root never loads. The tests always pass `-RepoRoot`, which hid it.
**Fix:** derive the root three levels up and drop the `-RepoRoot` parameter. Tests copy both scripts into a fake repo layout in TEMP and run them with no root argument, so the real repo is never touched.


### F-22 [P2] closed - Hook allows an env listing with assignments only, or after a prefix word
**Where:** `.claude/hooks/block-secret-commands.mjs:38,46`
**Problem:** Probed by passing strings to the hook (exit 0 = allowed): `env FOO=1` and `env FOO=1 | sort` print the whole environment (assignments with no command after them), and `nohup env`, `command env`, `timeout 5 env`, `! env` and `if env; then :; fi` are allowed because `nohup`, `command`, `builtin`, `timeout`, `nice`, `!` and `if`/`while`/`until` are not in `start`. F-09's fix said to allow only `env NAME=value cmd`, and `CLAUDE.md` says the hook blocks "the usual spellings".
**Fix:** treat `env` followed only by options and `NAME=value` words up to the end or a separator as listing; add those prefix words to `start`. Add each form above as a blocked case and keep `env NODE_ENV=test npm run build` allowed.

### F-23 [P3] closed - Hook allows printing one named secret variable
**Where:** `.claude/hooks/block-secret-commands.mjs:52-53`
**Problem:** `Write-Output $env:ConnectionStrings__VetiFlowDatabase`, `echo $VETIFLOW_TEST_POSTGRES` and `cat /proc/self/environ` are allowed. The first two print a full connection string, the thing the 2026-10-25 incident leaked. The `$env:NAME` carve-out is right for `PATH` and similar, but these names are known secrets.
**Fix:** block command text that names `ConnectionStrings__`, `ConnectionStrings:`, `CONNSTR_` or `VETIFLOW_TEST_POSTGRES`, and `/proc/<anything>/environ`. `db-target.ps1` reads them inside the script, which the hook never sees. Add blocked cases, or, if you prefer not to, say in the ai-interaction table that single named variables are not covered.

### F-24 [P3] closed - db-target leaves the bound string in the caller's session when not run with -File
**Where:** `scripts/db-target.ps1:145-159`
**Problem:** `-Migrate` and `-StartApp` set `ConnectionStrings__VetiFlowDatabase` and `ASPNETCORE_*`, and delete competing variables, at process scope. Run as documented (`powershell -File`) that process is a throwaway child. Run as `./scripts/db-target.ps1 -Migrate` from an interactive pwsh, the connection string stays in that session's environment, ready for a later printing or `dotnet` command, and the person's own competing variables are gone.
**Fix:** save the touched variables and restore them in a `finally`, or start the child with a `ProcessStartInfo` whose environment is set without changing this process. Add a test that runs the script with `&` and checks the caller's environment afterwards.


### F-25 [P3] accepted - Hook allows env after a leading assignment, eval, or a prefix word with options
**Where:** `.claude/hooks/block-secret-commands.mjs:39`
**Problem:** Probed by passing strings to the hook (exit 0 = allowed): `FOO=1 env`, `env FOO=1 env`, `sudo FOO=1 env`, `eval env`, `exec -a x env`, `nice -n 5 env`, `timeout -s KILL 5 env` and `stdbuf -oL env` all print the whole environment and are allowed, because `start` only accepts a separator or a bare prefix word directly before `env`. (`FOO=1 printenv` is blocked, since `printenv` has no `start` anchor.) The ai-interaction table already says the hook misses "spellings it doesn't list", so this is a documented limit, not a broken contract; but `FOO=1 env` is an ordinary bash form and `CLAUDE.md` says "the usual spellings". Each repair round has added more prefixes and new ones keep turning up.
**Fix:** drop the `start` anchor for `env` the way `printenv` has none: block `\benv` followed only by options or `NAME=value` words up to the end or a separator, wherever it appears as a word not preceded by `.`, `$` or `-` (so the allowed `grep -rn "import.meta.env"` case still passes; this also blocks harmless text such as `echo env` and `which env`; the Grep tool covers searches). Add the forms above as blocked cases and keep `env NODE_ENV=test npm run build` allowed. Or accept it and leave the table's sentence as the stated limit.


## Result

- **Shipped:** branch `fix/secret-guardrails`, squash-merged to `main` (the commit subject carries the PR number)
- **Verify:** `scripts/verify.ps1` on 2026-10-25 (Windows PowerShell 5.1; `pwsh` is not installed on this machine), exit 0
  - PASS  Workflow tests (secret guardrails: 301 checks)
  - PASS  Server build
  - PASS  Server tests (25 of 25)
  - PASS  Tool restore
  - PASS  No pending model changes
  - PASS  Client lint
  - PASS  Client build
  - PASS  Client tests (39 of 39)
- **Check:** integration through Claude Code's permission engine, harmless fixtures only, in a session started after `new-fixture.ps1`. All PASS:
  - Read tool on `scripts/tests/fixtures/.env.fixture`: denied by the permission settings.
  - Bash `cat` of the same file: blocked by `block-secret-commands.mjs`.
  - Read tool on `scripts/tests/fixtures/.env.example`: showed `FIXTURE_ONLY=not-a-secret`.
  - `dotnet user-secrets list` on the synthetic TEMP project: blocked by the hook.
  - `env -i FIXTURE_ONLY=not-a-secret /usr/bin/printenv`: blocked by the hook.
  - The `onFailure` probes: missing script, missing executable and crash each `failed; blocking because onFailure is "block"`; timeout `timed out; blocking ...`.
  - `remove-fixture.ps1`: the local settings file, the fixtures folder and the TEMP project are gone.
  - Seen along the way: a harmless `ls "$(cygpath ...)"` also triggered the timeout probe. Claude Code can't match an `if` rule against a command that contains `$(...)`, so it runs the scoped hook anyway (the safe direction). This only affects the probe hooks.
  - Also seen during `/complete`: the hook blocked a shell heredoc that only wrote this file, because its text named the fixture file and the commands. Writing docs that name them takes the Write tool.
- **Audit:** required (workflow safety checks and a `CLAUDE.md` hard rule). Four rounds: 16 findings closed (F-09 to F-24, three of them P1: F-15, F-16, F-20), F-25 [P3] accepted.
- **Follow-ups added to build plan:** none.
- **Deploy notes:** none for the app. For developers: `.claude/settings.json` runs the hook with `node`. If `node` is missing from PATH, every Bash and PowerShell call is blocked (`onFailure: "block"`). OS-level isolation needs the separate WSL2 sandbox setup above, which this branch does not do.
