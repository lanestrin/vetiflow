// Claude Code PreToolUse hook for Bash and PowerShell: blocks commands that list
// secret values, name a variable that holds a connection string, or name a .env
// file other than .env.example.
//
// Reads the hook event JSON from stdin. Exit 2 blocks the call and sends the
// stderr line to Claude; exit 0 leaves the normal permission flow in charge.
// Input that can't be read, or an event without a string command, is blocked too.
// Runs on Node so the same hook works on native Windows and in WSL2. The settings
// entry sets onFailure "block", so if node or this file is missing, the hook
// crashes or it times out, Claude Code blocks the call instead of running it.
//
// This matches command text only. It does not stop a script that reads files or
// environment variables itself. Never echo the command: it may hold a value.
import { readFileSync } from 'node:fs';

const reason =
	'Blocked by .claude/hooks/block-secret-commands.mjs: the command lists secret values or names a .env file. ' +
	'Use scripts/db-target.ps1 to check a database target, and harmless fixtures to test protections.';

function block() {
	process.stderr.write(`${reason}\n`);
	process.exit(2);
}

let command;
try {
	// Windows pipes may prepend a byte order mark, which JSON.parse rejects.
	const input = readFileSync(0, 'utf8').replace(/^﻿/, '');
	command = JSON.parse(input)?.tool_input?.command;
} catch {
	block();
}
// This hook only runs for Bash and PowerShell, which always send a command.
if (typeof command !== 'string') block();

// Where a command word can start: the beginning, after a separator, a subshell or
// backtick, a brace group, `sh -c "`, `cmd /c`, or a prefix such as sudo, nohup,
// if or `timeout 5`; then an optional path, so /usr/bin/env counts as env.
const start = String.raw`(?:^|[;&|({\x60\n]|\$\(|\b(?:sh|bash|zsh)\s+-c\s+["']?|\bcmd(?:\.exe)?\s+/[ck]\s+["']?|\b(?:sudo|exec|xargs|then|do|else|time|nohup|command|builtin|nice|if|while|until)\s|!\s|\btimeout\s+\S+\s)\s*["']?(?:[\w.~-]*[/\\])*`;
// The command word ends the command: nothing (or only a pipe or redirect) follows.
const bare = String.raw`(?=\s*$|\s*[;&|)}\x60>"'\n])`;
// A NAME=value word, with a quoted value or one that runs to a space or separator.
const assignment = String.raw`\w+=(?:"[^"]*"|'[^']*'|[^\s;&|)}>"'\x60])*`;

const secretListing = [
	String.raw`user-secrets\b[^;&|\n]*\blist\b`,
	String.raw`\bprintenv\b`,
	// env with no command after it (only NAME=value words, or nothing), or with
	// options, prints every variable.
	String.raw`${start}env(?:\s+${assignment})*(?:${bare}|\s+-)`,
	String.raw`${start}set${bare}`,
	String.raw`\bcmd(?:\.exe)?\s+/[ck]\s+["']?set\b(?!\s+\w+=)`,
	String.raw`${start}export(?:${bare}|\s+-p\b)`,
	String.raw`\b(?:declare|typeset)\s+-[a-z]*[px]`,
	String.raw`\bcompgen\s+-[a-z]*e`,
	// The PowerShell Env: drive, but not a single $env:NAME or ${env:NAME}.
	String.raw`(?<![$\{\w])env:`,
	String.raw`\[(?:System\.)?Environment\]::GetEnvironmentVariables`,
	// Variables known to hold a connection string, in any form, and a process's
	// whole environment under /proc. db-target.ps1 reads them inside the script.
	String.raw`ConnectionStrings(?:__|:)|CONNSTR_|VETIFLOW_TEST_POSTGRES`,
	String.raw`/proc/[^\s/]+/environ`,
].map((pattern) => new RegExp(pattern, 'i'));

if (secretListing.some((pattern) => pattern.test(command))) block();

// A .env file named on its own, after a path separator, or in a glob or brace
// list. Only an exact .env.example is allowed; .envrc is not a .env file.
const envFile = /(?:^|[\s/\\'"=(:{,\x60])(\.env[\w.*?[\]-]*)(?=$|[\s'";|&)>,}\x60])/gi;
for (const match of command.matchAll(envFile)) {
	const name = match[1].toLowerCase();
	if (/^\.env(?:[.*?[].*)?$/.test(name) && name !== '.env.example') block();
}

process.exit(0);
