# adobe-jira plugin

Jira plugin for Claude marketplace.

## Install

Add the marketplace, then install the skill:

```bash
/plugin marketplace add https://github.com/Adobe-AIFoundations/adobe-skills
/plugin install adobe-internal-tools@adobe-skills-marketplace
```

## Required environment variables

Set these before using the Jira skill:

### macOS/Linux (bash/zsh)

```bash
export JIRA_URL="https://jira.corp.adobe.com/"
export JIRA_PAT="your-jira-personal-access-token"
```

### macOS (persist in `.zprofile`)

Add these lines to `~/.zprofile`:

```bash
export JIRA_URL="https://jira.corp.adobe.com/"
export JIRA_PAT="your-jira-personal-access-token"
```

Then open a new terminal session.

### Windows (PowerShell)

```powershell
$env:JIRA_URL="https://jira.corp.adobe.com/"
$env:JIRA_PAT="your-jira-personal-access-token"
```

## Verify

```bash
echo "$JIRA_URL"
```

If `JIRA_URL` is set and `JIRA_PAT` is valid, the Jira skill can authenticate with PAT.
