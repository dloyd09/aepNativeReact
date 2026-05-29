#!/usr/bin/env bash
# Claude Code PostToolUse hook for AI writing pattern detection
# Runs after Write/Edit operations on markdown/text files
#
# Installation:
#   1. Copy this script to .claude/hooks/ai-writing-check.sh
#   2. chmod +x .claude/hooks/ai-writing-check.sh
#   3. Add to .claude/settings.json (see SKILL.md for config)

set -e

# Read JSON input from stdin
INPUT=$(cat)

# Extract tool info
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // ""')
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // ""')

# Only check Write/Edit on prose files
if [[ "$TOOL_NAME" != "Write" && "$TOOL_NAME" != "Edit" ]]; then
    exit 0
fi

if [[ ! "$FILE_PATH" =~ \.(md|txt|fountain)$ ]]; then
    exit 0
fi

if [[ ! -f "$FILE_PATH" ]]; then
    exit 0
fi

# Get content (for Write it's in tool_input, for Edit we read the file)
if [[ "$TOOL_NAME" == "Write" ]]; then
    CONTENT=$(echo "$INPUT" | jq -r '.tool_input.content // ""')
else
    CONTENT=$(cat "$FILE_PATH")
fi

# Count words
WORD_COUNT=$(echo "$CONTENT" | wc -w | tr -d ' ')

# Skip small files
if [[ $WORD_COUNT -lt 100 ]]; then
    exit 0
fi

# Initialize counters
ISSUES=""
ISSUE_COUNT=0

# ============================================
# Check 1: Em-dash rate
# ============================================
EM_DASH_COUNT=$(echo "$CONTENT" | grep -o '—' | wc -l | tr -d ' ')
if [[ $WORD_COUNT -gt 0 ]]; then
    # Rate per 1000 words
    DASH_RATE=$(echo "scale=2; $EM_DASH_COUNT * 1000 / $WORD_COUNT" | bc)
    # Threshold: 5 per 1000 words (0.5%)
    if (( $(echo "$DASH_RATE > 5" | bc -l) )); then
        ISSUES="$ISSUES\n• Em-dash rate: ${DASH_RATE}/1000 words (threshold: 5)"
        ISSUE_COUNT=$((ISSUE_COUNT + 1))
    fi
fi

# ============================================
# Check 2: Forced juxtaposition patterns
# ============================================
LOWERCASE=$(echo "$CONTENT" | tr '[:upper:]' '[:lower:]')

# Not just X, but Y
NOT_JUST=$(echo "$LOWERCASE" | grep -oiE 'not (just|simply|merely|only) [^.!?]{1,40}, but' | wc -l | tr -d ' ')
if [[ $NOT_JUST -gt 2 ]]; then
    ISSUES="$ISSUES\n• 'Not just X, but Y' pattern: $NOT_JUST instances (limit: 2)"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# It's not X, it's Y
ITS_NOT=$(echo "$LOWERCASE" | grep -oiE "it.s not [^.!?]{1,30}it.s" | wc -l | tr -d ' ')
if [[ $ITS_NOT -gt 2 ]]; then
    ISSUES="$ISSUES\n• \"It's not X, it's Y\" pattern: $ITS_NOT instances (limit: 2)"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# Not only...but also
NOT_ONLY=$(echo "$LOWERCASE" | grep -oiE 'not only [^.!?]{1,60}but also' | wc -l | tr -d ' ')
if [[ $NOT_ONLY -gt 2 ]]; then
    ISSUES="$ISSUES\n• 'Not only...but also' pattern: $NOT_ONLY instances (limit: 2)"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# ============================================
# Check 3: AI vocabulary (top 10 words)
# ============================================
AI_VOCAB_COUNT=0
for word in delve tapestry underscore showcase pivotal multifaceted vibrant fostering intricate testament; do
    count=$(echo "$LOWERCASE" | grep -oE "\b${word}\b" | wc -l | tr -d ' ')
    AI_VOCAB_COUNT=$((AI_VOCAB_COUNT + count))
done

# More than 5 AI vocabulary words per 1000 words is suspicious
if [[ $WORD_COUNT -gt 0 ]]; then
    VOCAB_RATE=$(echo "scale=2; $AI_VOCAB_COUNT * 1000 / $WORD_COUNT" | bc)
    if (( $(echo "$VOCAB_RATE > 5" | bc -l) )); then
        ISSUES="$ISSUES\n• AI vocabulary density: ${VOCAB_RATE}/1000 words (threshold: 5)"
        ISSUE_COUNT=$((ISSUE_COUNT + 1))
    fi
fi

# ============================================
# Check 4: Common AI phrases
# ============================================
PHRASE_COUNT=0
for phrase in "it.s important to note" "in today.s world" "let.s (dive|delve)" "in conclusion" "to sum up" "stands as a testament" "plays a (vital|crucial|pivotal) role"; do
    count=$(echo "$LOWERCASE" | grep -oiE "$phrase" | wc -l | tr -d ' ')
    PHRASE_COUNT=$((PHRASE_COUNT + count))
done

if [[ $PHRASE_COUNT -gt 3 ]]; then
    ISSUES="$ISSUES\n• Common AI phrases: $PHRASE_COUNT instances (threshold: 3)"
    ISSUE_COUNT=$((ISSUE_COUNT + 1))
fi

# ============================================
# Output results
# ============================================
if [[ $ISSUE_COUNT -gt 0 ]]; then
    FILENAME=$(basename "$FILE_PATH")

    # Build feedback message
    FEEDBACK="AI writing pattern check for $FILENAME:$ISSUES"

    # Determine severity
    if [[ $ISSUE_COUNT -ge 3 ]]; then
        SEVERITY="high"
        FEEDBACK="$FEEDBACK\n\n⚠️  Multiple AI patterns detected. Consider revising for more natural prose."
    else
        SEVERITY="medium"
        FEEDBACK="$FEEDBACK\n\nℹ️  Some AI patterns detected. Review if intentional."
    fi

    # Output JSON for Claude
    jq -n \
        --arg feedback "$FEEDBACK" \
        --arg severity "$SEVERITY" \
        --argjson count "$ISSUE_COUNT" \
        '{
            "hookSpecificOutput": {
                "hookEventName": "PostToolUse",
                "additionalContext": $feedback,
                "severity": $severity,
                "issueCount": $count
            }
        }'
fi

exit 0
