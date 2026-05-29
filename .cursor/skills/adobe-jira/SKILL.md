---
name: adobe-jira
description: Full Jira integration - create, view, search, comment, transition, and assign tickets. Use for any Jira-related tasks.
disable-model-invocation: false
argument-hint: <command> [options]
allowed-tools:
  - Bash
---

# Jira Skill

Full Jira integration for Claude Code.

## Usage

```bash
uv run ./scripts/jira_cli.py <command> [options]
```

Run commands from the `adobe-jira` directory (or pass an absolute path to `jira_cli.py`).

## Commands

| Command | Description |
|---------|-------------|
| `create -p PROJECT -s "Summary" [-t Type] [-d Desc]` | Create ticket |
| `view <KEY>` | View ticket details |
| `search "<JQL>" [--limit N]` | Search with JQL |
| `comment <KEY> "<text>"` | Add comment |
| `transition <KEY> <status>` | Change status |
| `assign <KEY> <user>` | Assign ticket |
| `update <KEY> [--summary] [--description] [--priority] [--assignee] [--add-labels] [--remove-labels]` | Update ticket fields |
| `my [--limit N]` | My open tickets |

## Examples

```bash
# Create
uv run ./scripts/jira_cli.py create -p ADOBE -s "Fix login bug" -t Bug

# View
uv run ./scripts/jira_cli.py view ADOBE-123

# Search
uv run ./scripts/jira_cli.py search "project=adobe AND status='In Progress'" --limit 10

# Comment
uv run ./scripts/jira_cli.py comment ADOBE-123 "Fixed in PR #456"

# Transition
uv run ./scripts/jira_cli.py transition ADOBE-123 "In Progress"

# Assign
uv run ./scripts/jira_cli.py assign ADOBE-123 john.doe

# Update
uv run ./scripts/jira_cli.py update ADOBE-123 --summary "New summary" --priority "High" --add-labels "urgent,bug-fix"

# My tickets
uv run ./scripts/jira_cli.py my
```

## Configuration

Environment variables:
- `JIRA_URL` - Jira server URL (e.g. `https://jira.corp.adobe.com/`)
- `JIRA_PAT` - Personal access token
- `JIRA_CACHE_FILE` - Optional path override for cache file
