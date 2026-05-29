#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = ["jira"]
# ///
"""
Full Jira CLI for Claude Code.

Commands: create, view, search, comment, transition, assign, my

Environment Variables:
    JIRA_URL - Jira server URL
    JIRA_PAT - Personal access token
"""

import argparse
import json
import os
import sys
import time
from pathlib import Path

try:
    from jira import JIRA
    from jira.exceptions import JIRAError
except ImportError:
    print("Error: jira library not installed. Run: pip install jira", file=sys.stderr)
    sys.exit(1)


# Cache path:
# - Defaults are relative to this skill directory so the plugin is portable.
# - Env var allows users to override location when needed.
SKILL_DIR = Path(__file__).resolve().parent.parent
CACHE_FILE = Path(os.environ.get("JIRA_CACHE_FILE", SKILL_DIR / ".cache.json"))
CACHE_TTL = 3600  # 1 hour


def load_cache():
    """Load metadata cache."""
    if CACHE_FILE.exists():
        try:
            with open(CACHE_FILE, 'r') as f:
                cache = json.load(f)
                if cache.get("_timestamp", 0) + CACHE_TTL > time.time():
                    return cache
        except Exception:
            pass
    return {"_timestamp": time.time()}


def save_cache(cache):
    """Save metadata cache."""
    cache["_timestamp"] = time.time()
    try:
        with open(CACHE_FILE, 'w') as f:
            json.dump(cache, f)
    except Exception:
        pass


def get_jira_client():
    """Initialize Jira client using PAT authentication."""
    url = os.environ.get("JIRA_URL", "").rstrip('/')
    pat = os.environ.get("JIRA_PAT")

    if not url:
        print("Error: JIRA_URL not set", file=sys.stderr)
        sys.exit(1)

    if not pat:
        print("Error: JIRA_PAT not set", file=sys.stderr)
        sys.exit(1)

    try:
        return JIRA(server=url, token_auth=pat)
    except Exception as e:
        print(f"Error connecting to Jira: {e}", file=sys.stderr)
        sys.exit(1)


def get_transitions(jira, issue_key):
    """Get available transitions for an issue (cached)."""
    cache = load_cache()
    cache_key = f"transitions:{issue_key}"

    if cache_key not in cache:
        transitions = jira.transitions(issue_key)
        cache[cache_key] = [{"id": t["id"], "name": t["name"]} for t in transitions]
        save_cache(cache)

    return cache[cache_key]


def get_issue_types(jira, project_key):
    """Get issue types for a project (cached)."""
    cache = load_cache()
    cache_key = f"issue_types:{project_key}"

    if cache_key not in cache:
        try:
            project = jira.project(project_key)
            types = jira.issue_types_for_project(project.id)
            cache[cache_key] = [t.name for t in types]
            save_cache(cache)
        except Exception:
            return ["Task", "Bug", "Story", "Epic"]

    return cache[cache_key]


def format_issue(issue, verbose=False):
    """Format issue for display."""
    fields = issue.fields
    status = fields.status.name if fields.status else "Unknown"
    assignee = fields.assignee.displayName if fields.assignee else "Unassigned"
    priority = fields.priority.name if fields.priority else "None"

    lines = [
        f"{issue.key}: {fields.summary}",
        f"  Status: {status} | Assignee: {assignee} | Priority: {priority}",
    ]

    if verbose:
        lines.append(f"  Type: {fields.issuetype.name}")
        if fields.labels:
            lines.append(f"  Labels: {', '.join(fields.labels)}")
        if fields.description:
            lines.append(f"  Description: {fields.description}")
        lines.append(f"  URL: {issue.permalink()}")

    return "\n".join(lines)


# ============ Commands ============

def cmd_create(jira, args):
    """Create a new ticket."""
    project = args.project

    if not args.summary:
        print("Error: --summary required", file=sys.stderr)
        sys.exit(1)

    # Validate issue type
    valid_types = get_issue_types(jira, project)
    issue_type = args.type
    if issue_type.lower() not in [t.lower() for t in valid_types]:
        print(f"Warning: '{issue_type}' may not be valid. Available: {', '.join(valid_types)}", file=sys.stderr)

    fields = {
        "project": {"key": project},
        "summary": args.summary,
        "issuetype": {"name": issue_type},
    }

    if args.description:
        fields["description"] = args.description
    if args.priority:
        fields["priority"] = {"name": args.priority}
    if args.assignee:
        fields["assignee"] = {"name": args.assignee}

    labels = []
    if args.labels:
        cleaned_labels = [label.strip() for label in args.labels.split(",") if label.strip()]
        labels.extend(cleaned_labels)
    if labels:
        fields["labels"] = list(set(labels))

    try:
        issue = jira.create_issue(fields=fields)
        print(f"\nCreated: {issue.key}")
        print(f"Summary: {args.summary}")
        print(f"Type: {issue_type}")
        print(f"URL: {issue.permalink()}")
    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_view(jira, args):
    """View ticket details."""
    try:
        issue = jira.issue(args.key)
        print(format_issue(issue, verbose=True))

        # Show recent comments
        if args.comments:
            comments = jira.comments(args.key)
            if comments:
                print(f"\nComments ({len(comments)}):")
                for c in comments:
                    author = c.author.displayName if c.author else "Unknown"
                    body = c.body
                    print(f"  [{author}]: {body}")

    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_search(jira, args):
    """Search with JQL."""
    try:
        issues = jira.search_issues(args.jql, maxResults=args.limit)
        print(f"Found {len(issues)} issues:\n")
        for issue in issues:
            print(format_issue(issue))
            print()
    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_comment(jira, args):
    """Add comment to ticket."""
    try:
        jira.add_comment(args.key, args.text)
        print(f"Comment added to {args.key}")
    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_transition(jira, args):
    """Change ticket status."""
    try:
        transitions = get_transitions(jira, args.key)
        target = args.status.lower()

        # Find matching transition
        match = None
        for t in transitions:
            if target in t["name"].lower():
                match = t
                break

        if not match:
            available = [t["name"] for t in transitions]
            print(f"Error: Status '{args.status}' not available", file=sys.stderr)
            print(f"Available: {', '.join(available)}", file=sys.stderr)
            sys.exit(1)

        jira.transition_issue(args.key, match["id"])
        print(f"{args.key} transitioned to: {match['name']}")

        # Invalidate cache
        cache = load_cache()
        cache.pop(f"transitions:{args.key}", None)
        save_cache(cache)

    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_assign(jira, args):
    """Assign ticket."""
    try:
        jira.assign_issue(args.key, args.user)
        print(f"{args.key} assigned to: {args.user}")
    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_update(jira, args):
    """Update ticket fields."""
    try:
        issue = jira.issue(args.key)
        fields = {}

        if args.summary:
            fields['summary'] = args.summary
        if args.description:
            fields['description'] = args.description
        if args.priority:
            fields['priority'] = {"name": args.priority}

        # Update basic fields if any
        if fields:
            issue.update(fields=fields)

        # Handle labels separately
        if args.add_labels:
            labels = args.add_labels.split(",")
            for label in labels:
                issue.fields.labels.append(label.strip())
            issue.update(fields={"labels": issue.fields.labels})

        if args.remove_labels:
            to_remove = {x.strip() for x in args.remove_labels.split(",")}
            issue.fields.labels = [l for l in issue.fields.labels if l not in to_remove]
            issue.update(fields={"labels": issue.fields.labels})

        # Handle assignee
        if args.assignee:
            jira.assign_issue(args.key, args.assignee)

        print(f"Updated {args.key}")

        # Show updated issue
        updated_issue = jira.issue(args.key)
        print(format_issue(updated_issue, verbose=True))

    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def cmd_my(jira, args):
    """Show my open tickets."""
    try:
        jql = "assignee = currentUser() AND resolution = Unresolved ORDER BY updated DESC"
        issues = jira.search_issues(jql, maxResults=args.limit)

        if not issues:
            print("No open tickets assigned to you")
            return

        print(f"Your open tickets ({len(issues)}):\n")
        for issue in issues:
            print(format_issue(issue))
            print()
    except JIRAError as e:
        print(f"Error: {e.text}", file=sys.stderr)
        sys.exit(1)


def main():
    parser = argparse.ArgumentParser(description="Jira CLI for Claude Code")
    subparsers = parser.add_subparsers(dest="command", required=True)

    # create
    create_p = subparsers.add_parser("create", help="Create ticket")
    create_p.add_argument("--project", "-p", required=True, help="Project key")
    create_p.add_argument("--type", "-t", default="Task", help="Issue type (default: Task)")
    create_p.add_argument("--summary", "-s", required=True, help="Summary")
    create_p.add_argument("--description", "-d", help="Description")
    create_p.add_argument("--priority", help="Priority")
    create_p.add_argument("--assignee", "-a", help="Assignee")
    create_p.add_argument("--labels", "-l", help="Comma-separated labels")

    # view
    view_p = subparsers.add_parser("view", help="View ticket")
    view_p.add_argument("key", help="Issue key (e.g., OZ-123)")
    view_p.add_argument("--comments", "-c", action="store_true", help="Show comments")

    # search
    search_p = subparsers.add_parser("search", help="Search with JQL")
    search_p.add_argument("jql", help="JQL query")
    search_p.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")

    # comment
    comment_p = subparsers.add_parser("comment", help="Add comment")
    comment_p.add_argument("key", help="Issue key")
    comment_p.add_argument("text", help="Comment text")

    # transition
    trans_p = subparsers.add_parser("transition", help="Change status")
    trans_p.add_argument("key", help="Issue key")
    trans_p.add_argument("status", help="Target status")

    # assign
    assign_p = subparsers.add_parser("assign", help="Assign ticket")
    assign_p.add_argument("key", help="Issue key")
    assign_p.add_argument("user", help="Username to assign")

    # update
    update_p = subparsers.add_parser("update", help="Update ticket fields")
    update_p.add_argument("key", help="Issue key (e.g., OZ-123)")
    update_p.add_argument("--summary", "-s", help="New summary")
    update_p.add_argument("--description", "-d", help="New description")
    update_p.add_argument("--priority", help="New priority")
    update_p.add_argument("--assignee", "-a", help="New assignee")
    update_p.add_argument("--add-labels", help="Comma-separated labels to add")
    update_p.add_argument("--remove-labels", help="Comma-separated labels to remove")

    # my
    my_p = subparsers.add_parser("my", help="My open tickets")
    my_p.add_argument("--limit", type=int, default=10, help="Max results (default: 10)")

    args = parser.parse_args()
    jira = get_jira_client()

    commands = {
        "create": cmd_create,
        "view": cmd_view,
        "search": cmd_search,
        "comment": cmd_comment,
        "transition": cmd_transition,
        "assign": cmd_assign,
        "update": cmd_update,
        "my": cmd_my,
    }

    commands[args.command](jira, args)


if __name__ == "__main__":
    main()
