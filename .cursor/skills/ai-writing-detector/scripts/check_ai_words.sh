#!/usr/bin/env bash
# AI Word Rate Checker
# Detects overused AI vocabulary by comparing actual rates to corpus base rates
# Usage: ./check_ai_words.sh <file> [multiplier]
# Default multiplier: 3 (flag words appearing 3x more than expected)

set -e

FILE="${1:?Usage: $0 <file> [multiplier]}"
MULTIPLIER="${2:-3}"

if [[ ! -f "$FILE" ]]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

# Get script directory for rates file
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RATES_FILE="$SCRIPT_DIR/ai_word_rates.txt"

# Count total words
TOTAL_WORDS=$(wc -w < "$FILE" | tr -d ' ')

if [[ $TOTAL_WORDS -lt 100 ]]; then
    echo "Warning: File has only $TOTAL_WORDS words. Results may be unreliable." >&2
fi

# Convert file to lowercase for matching
LOWERCASE=$(tr '[:upper:]' '[:lower:]' < "$FILE")

echo "## AI Word Rate Analysis"
echo ""
echo "**File:** $FILE"
echo "**Total words:** $TOTAL_WORDS"
echo "**Threshold:** ${MULTIPLIER}x base rate"
echo ""

VIOLATIONS=0
TOTAL_FOUND=0
VIOLATION_LIST=""

echo "| Word | Count | Expected | Actual/M | Base/M | Ratio |"
echo "|------|-------|----------|----------|--------|-------|"

# Read rates from file
while IFS=: read -r word base_rate; do
    # Skip empty lines and comments
    [[ -z "$word" || "$word" == \#* ]] && continue

    # Count occurrences (whole word match)
    count=$(echo "$LOWERCASE" | grep -oE "\b${word}\b" 2>/dev/null | wc -l | tr -d ' ')

    if [[ $count -gt 0 ]]; then
        TOTAL_FOUND=$((TOTAL_FOUND + count))

        # Calculate expected count: (total_words * rate_per_million) / 1000000
        expected=$(echo "scale=2; $TOTAL_WORDS * $base_rate / 1000000" | bc)

        # Calculate actual rate per million
        actual_rate=$(echo "scale=2; $count * 1000000 / $TOTAL_WORDS" | bc)

        # Calculate ratio
        if [[ $(echo "$expected > 0.01" | bc) -eq 1 ]]; then
            ratio=$(echo "scale=1; $count / $expected" | bc)
        else
            ratio=$(echo "scale=1; $actual_rate / $base_rate" | bc)
        fi

        # Check if violation
        is_violation=$(echo "$actual_rate > $base_rate * $MULTIPLIER" | bc)

        if [[ $is_violation -eq 1 ]]; then
            VIOLATIONS=$((VIOLATIONS + 1))
            VIOLATION_LIST="$VIOLATION_LIST $word($count)"
            echo "| **$word** | $count | $expected | $actual_rate | $base_rate | **${ratio}x** |"
        else
            echo "| $word | $count | $expected | $actual_rate | $base_rate | ${ratio}x |"
        fi
    fi
done < "$RATES_FILE"

echo ""
echo "---"
echo ""
echo "**AI vocabulary found:** $TOTAL_FOUND instances"

if [[ $VIOLATIONS -gt 0 ]]; then
    echo "**Violations:** $VIOLATIONS words exceed ${MULTIPLIER}x threshold"
    echo "**Flagged:**$VIOLATION_LIST"

    if [[ $VIOLATIONS -ge 6 ]]; then
        echo ""
        echo "### Confidence: HIGH"
        echo "Multiple AI vocabulary indicators significantly exceed base rates."
    elif [[ $VIOLATIONS -ge 3 ]]; then
        echo ""
        echo "### Confidence: MEDIUM"
        echo "Several AI vocabulary indicators exceed base rates."
    else
        echo ""
        echo "### Confidence: LOW"
        echo "Few indicators exceed threshold. Could be coincidence."
    fi
else
    echo ""
    echo "### Result: PASS"
    echo "No significant AI vocabulary rate violations detected."
fi
