#!/usr/bin/env bash
# AI Pattern Checker - Comprehensive Analysis
# Checks vocabulary rates, em-dash usage, and structural patterns
# Usage: ./check_ai_patterns.sh <file> [multiplier]

set -e

FILE="${1:?Usage: $0 <file> [multiplier]}"
MULTIPLIER="${2:-3}"

if [[ ! -f "$FILE" ]]; then
    echo "Error: File not found: $FILE" >&2
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
RATES_FILE="$SCRIPT_DIR/ai_word_rates.txt"

# Read file content
CONTENT=$(cat "$FILE")
LOWERCASE=$(echo "$CONTENT" | tr '[:upper:]' '[:lower:]')

# Count total words
TOTAL_WORDS=$(echo "$CONTENT" | wc -w | tr -d ' ')

echo "# AI Pattern Analysis Report"
echo ""
echo "**File:** \`$FILE\`"
echo "**Total words:** $TOTAL_WORDS"
echo "**Analysis date:** $(date +%Y-%m-%d)"
echo ""

# ============================================
# SECTION 1: Em-Dash Analysis
# ============================================
echo "## 1. Em-Dash Analysis"
echo ""

# Count em-dashes (both Unicode and ASCII approximations)
EM_DASH_COUNT=$(echo "$CONTENT" | grep -o '—' | wc -l | tr -d ' ')
DOUBLE_HYPHEN=$(echo "$CONTENT" | grep -oE ' -- ' | wc -l | tr -d ' ')
TOTAL_DASHES=$((EM_DASH_COUNT + DOUBLE_HYPHEN))

# Calculate rate per 1000 words
if [[ $TOTAL_WORDS -gt 0 ]]; then
    DASH_RATE=$(echo "scale=2; $TOTAL_DASHES * 1000 / $TOTAL_WORDS" | bc)
else
    DASH_RATE=0
fi

# Threshold: 5 per 1000 words (1 per 200 words)
DASH_THRESHOLD=5

echo "- Em-dashes (—): $EM_DASH_COUNT"
echo "- Double-hyphens (--): $DOUBLE_HYPHEN"
echo "- **Total:** $TOTAL_DASHES"
echo "- **Rate:** $DASH_RATE per 1000 words"
echo "- **Threshold:** $DASH_THRESHOLD per 1000 words"
echo ""

if (( $(echo "$DASH_RATE > $DASH_THRESHOLD" | bc -l) )); then
    echo "⚠️  **Em-dash overuse detected** (${DASH_RATE} > ${DASH_THRESHOLD})"
    DASH_FLAG=1
else
    echo "✓ Em-dash rate within normal range"
    DASH_FLAG=0
fi
echo ""

# ============================================
# SECTION 2: Vocabulary Analysis
# ============================================
echo "## 2. Vocabulary Analysis"
echo ""
echo "Checking ${MULTIPLIER}x threshold against corpus base rates..."
echo ""

VOCAB_VIOLATIONS=0
VOCAB_TOTAL=0
VIOLATION_WORDS=""

echo "| Word | Count | Expected | Rate/M | Base/M | Ratio |"
echo "|------|-------|----------|--------|--------|-------|"

while IFS=: read -r word base_rate; do
    [[ -z "$word" || "$word" == \#* ]] && continue

    count=$(echo "$LOWERCASE" | grep -oE "\b${word}\b" 2>/dev/null | wc -l | tr -d ' ')

    if [[ $count -gt 0 ]]; then
        VOCAB_TOTAL=$((VOCAB_TOTAL + count))

        expected=$(echo "scale=2; $TOTAL_WORDS * $base_rate / 1000000" | bc)
        actual_rate=$(echo "scale=2; $count * 1000000 / $TOTAL_WORDS" | bc)

        if [[ $(echo "$expected > 0.01" | bc) -eq 1 ]]; then
            ratio=$(echo "scale=1; $count / $expected" | bc)
        else
            ratio=$(echo "scale=1; $actual_rate / $base_rate" | bc)
        fi

        is_violation=$(echo "$actual_rate > $base_rate * $MULTIPLIER" | bc)

        if [[ $is_violation -eq 1 ]]; then
            VOCAB_VIOLATIONS=$((VOCAB_VIOLATIONS + 1))
            VIOLATION_WORDS="$VIOLATION_WORDS $word($count)"
            echo "| **$word** | $count | $expected | $actual_rate | $base_rate | **${ratio}x** |"
        else
            echo "| $word | $count | $expected | $actual_rate | $base_rate | ${ratio}x |"
        fi
    fi
done < "$RATES_FILE"

echo ""
echo "**AI vocabulary instances:** $VOCAB_TOTAL"
if [[ $VOCAB_VIOLATIONS -gt 0 ]]; then
    echo "**Violations:** $VOCAB_VIOLATIONS words exceed ${MULTIPLIER}x threshold"
    echo "**Flagged:**$VIOLATION_WORDS"
fi
echo ""

# ============================================
# SECTION 3: Phrase Pattern Analysis
# ============================================
echo "## 3. Phrase Patterns"
echo ""

# Check for common AI phrases
PHRASE_COUNT=0
PHRASE_LIST=""

check_phrase() {
    local pattern="$1"
    local label="$2"
    local count=$(echo "$LOWERCASE" | grep -oiE "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    if [[ $count -gt 0 ]]; then
        PHRASE_COUNT=$((PHRASE_COUNT + count))
        PHRASE_LIST="$PHRASE_LIST\n- **$label**: $count"
    fi
}

check_phrase "it.s important to (note|remember|consider)" "Hedging preamble"
check_phrase "it.s worth (noting|mentioning)" "Worth noting"
check_phrase "in today.s world" "In today's world"
check_phrase "in this (article|guide|post)" "Article opener"
check_phrase "let.s (dive|delve)" "Let's dive/delve"
check_phrase "at the end of the day" "At the end of the day"
check_phrase "in conclusion" "In conclusion"
check_phrase "to sum up" "To sum up"
check_phrase "not only .+ but also" "Not only...but also"
check_phrase "it.s not (just|simply) .+, it.s" "It's not X, it's Y"
check_phrase "(stands|serves) as a testament" "Testament phrase"
check_phrase "plays a (vital|crucial|pivotal|significant) role" "Plays X role"
check_phrase "(rich|complex) tapestry" "Tapestry metaphor"
check_phrase "navigat(e|ing) the .+ landscape" "Navigate landscape"
check_phrase "embark on a journey" "Embark journey"
check_phrase "beacon of" "Beacon of"
check_phrase "despite .+ challenges" "Despite challenges"

echo ""
echo "### Forced Juxtapositions" >> /dev/null  # Count separately

JUXT_COUNT=0
JUXT_LIST=""

check_juxt() {
    local pattern="$1"
    local label="$2"
    local count=$(echo "$LOWERCASE" | grep -oiE "$pattern" 2>/dev/null | wc -l | tr -d ' ')
    if [[ $count -gt 0 ]]; then
        JUXT_COUNT=$((JUXT_COUNT + count))
        JUXT_LIST="$JUXT_LIST\n- **$label**: $count"
    fi
}

# Core AI juxtaposition patterns
check_juxt "[Nn]ot (just|simply|merely|only) [^.!?]{1,40}, but" "Not just X, but Y"
check_juxt "not about [^.!?]{1,30}it.s about" "Not about X, it's about Y"
check_juxt "[Ii]t.s not [^.!?]{1,30}it.s" "It's not X, it's Y"
check_juxt "[Nn]ot only [^.!?]{1,60}but also" "Not only...but also"
check_juxt "more than (just |simply |merely )[a-z]" "More than just X"
check_juxt "go(es)? beyond [^.!?]{5,30}to" "Goes beyond X to Y"

if [[ $JUXT_COUNT -gt 0 ]]; then
    echo "**Forced juxtapositions found:** $JUXT_COUNT"
    echo -e "$JUXT_LIST"
    echo ""
    PHRASE_COUNT=$((PHRASE_COUNT + JUXT_COUNT))
fi

if [[ $PHRASE_COUNT -gt 0 ]]; then
    echo "**AI phrases found:** $PHRASE_COUNT"
    echo -e "$PHRASE_LIST"
else
    echo "No common AI phrases detected."
fi
echo ""

# ============================================
# SECTION 4: Summary
# ============================================
echo "## 4. Summary"
echo ""

# Calculate overall score
SCORE=0
[[ $DASH_FLAG -eq 1 ]] && SCORE=$((SCORE + 2))
[[ $VOCAB_VIOLATIONS -ge 6 ]] && SCORE=$((SCORE + 3))
[[ $VOCAB_VIOLATIONS -ge 3 && $VOCAB_VIOLATIONS -lt 6 ]] && SCORE=$((SCORE + 2))
[[ $VOCAB_VIOLATIONS -ge 1 && $VOCAB_VIOLATIONS -lt 3 ]] && SCORE=$((SCORE + 1))
[[ $PHRASE_COUNT -ge 3 ]] && SCORE=$((SCORE + 2))
[[ $PHRASE_COUNT -ge 1 && $PHRASE_COUNT -lt 3 ]] && SCORE=$((SCORE + 1))

echo "| Category | Finding |"
echo "|----------|---------|"
echo "| Em-dash rate | $DASH_RATE per 1000 words |"
echo "| Vocabulary violations | $VOCAB_VIOLATIONS |"
echo "| AI phrases | $PHRASE_COUNT |"
echo "| **Score** | $SCORE / 7 |"
echo ""

if [[ $SCORE -ge 5 ]]; then
    echo "### Confidence: HIGH"
    echo "Multiple strong indicators of AI-generated content across categories."
elif [[ $SCORE -ge 3 ]]; then
    echo "### Confidence: MEDIUM"
    echo "Several indicators present. Content warrants closer review."
elif [[ $SCORE -ge 1 ]]; then
    echo "### Confidence: LOW"
    echo "Few indicators detected. Likely human-written or well-edited AI."
else
    echo "### Result: PASS"
    echo "No significant AI patterns detected."
fi
