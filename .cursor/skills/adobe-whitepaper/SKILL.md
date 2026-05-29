---
name: adobe-whitepaper
description: Creates professional Adobe-branded PDF whitepapers from Markdown files. Use when the user wants to create a whitepaper, technical document, or PDF using Adobe branding and Adobe Clean fonts.
allowed-tools: Read, Write, Edit, Bash(pandoc *), Bash(TYPST_FONT_PATHS=* pandoc *), Bash(cp *), Bash(ls *), Bash(mkdir *), Bash(rm *), Bash(open *), Bash(~/.claude/skills/ai-writing-detector/scripts/*)
metadata:
  argument-hint: "[input.md] [output.pdf]"
---

# Adobe Whitepaper PDF Generator

This skill converts Markdown files into professionally typeset Adobe-branded PDF whitepapers using pandoc and typst.

## Assets

The skill includes:
- **Typst template**: `~/.claude/skills/adobe-whitepaper/templates/adobe-whitepaper.typ`
- **Adobe Clean fonts**: `~/.claude/skills/adobe-whitepaper/fonts/` — full family: Black, BlackIt, Bold, BoldCond, BoldCondIt, BoldIt, BoldSemiCn, BoldSemiCnIt, Cond, CondIt, ExtraBold, ExtraBoldIt, Italic, Light, LightIt, Medium, Regular, SemiCn, SemiCnIt, SemiLight, SemiLightIt
- **Source Code Pro fonts**: `~/.claude/skills/adobe-whitepaper/fonts/` (Regular, Bold, Italic, Bold Italic) — used for code blocks and inline code. Latest official release (v2.042) from [adobe-fonts/source-code-pro](https://github.com/adobe-fonts/source-code-pro)
- **Adobe wordmark**: `~/.claude/skills/adobe-whitepaper/assets/` — Red and White variants in SVG and PNG (RGB color space)
- **Adobe icon**: `~/.claude/skills/adobe-whitepaper/assets/` — Red and White variants in SVG and PNG (RGB color space)

### Typography Hierarchy (per Adobe Brand Guidelines)

| Element | Weight | Tracking | Leading |
|---------|--------|----------|---------|
| Headlines (H1) | Adobe Clean Black | -20 | 90% |
| Section headlines (H2) | Adobe Clean ExtraBold | -20 | 110% |
| Subheads (H3, H4) | Adobe Clean Bold | -20 | 110% |
| Body copy | Adobe Clean Regular | 0 | 120% |
| Pull-quotes | Adobe Clean SemiLight | -10 | 120% |

## Usage

When the user asks to create a whitepaper PDF, follow these steps:

### 1. Determine Input and Output

- Parse `$ARGUMENTS` for the input markdown file and optional output PDF path
- If no output path is given, use the same name as the input with a `.pdf` extension
- If no input is given, ask the user which markdown file to convert
- Check the file's YAML frontmatter (see "Frontmatter Reference" below). If `title` is missing, ask the user for a title before proceeding. If `date` is missing, default to today's date.

### 2. Check for AI Writing Patterns (Pre-flight)

Before converting, offer to run the AI writing pattern detector on the markdown source. This uses the companion `ai-writing-detector` skill scripts.

Ask the user: **"Would you like me to check the document for AI writing patterns before generating the PDF?"**

If yes, run the analysis:

```bash
~/.claude/skills/ai-writing-detector/scripts/check_ai_patterns.sh <input.md> 3
```

Report the findings using the output format from the ai-writing-detector skill. If significant AI patterns are detected (confidence Medium or High), offer to help revise the flagged passages before proceeding with PDF generation.

If the user declines the check or after any revisions are complete, proceed to the next step.

### 3. Copy Template and Assets

Copy the typst template and required assets to the same directory as the input markdown file (pandoc/typst requires local paths):

```bash
cp ~/.claude/skills/adobe-whitepaper/templates/adobe-whitepaper.typ <output-directory>/adobe-whitepaper.typ
cp ~/.claude/skills/adobe-whitepaper/assets/Adobe_Wordmark_RGB_Red.svg <output-directory>/Adobe_Wordmark_RGB_Red.svg
```

### 4. Run Pandoc

Execute the conversion with these exact flags (setting `TYPST_FONT_PATHS` ensures all Adobe Clean weights are found):

```bash
TYPST_FONT_PATHS=~/.claude/skills/adobe-whitepaper/fonts pandoc <input.md> \
  -o <output.pdf> \
  --pdf-engine=typst \
  -V template="adobe-whitepaper.typ" \
  -V mainfont="Adobe Clean" \
  -V fontsize=10pt \
  -V papersize=a4
```

Note: Do **not** pass `--toc` — the template generates its own table of contents page with proper Adobe branding.

### 5. Clean Up

Remove the copied template and asset files from the output directory after successful conversion:

```bash
rm <output-directory>/adobe-whitepaper.typ <output-directory>/Adobe_Wordmark_RGB_Red.svg
```

### 6. Report Result

Tell the user the PDF was created and its path.

## Frontmatter Reference

The template reads pandoc YAML frontmatter from the markdown file to populate the title page and footer. The frontmatter block must be the very first thing in the file, delimited by `---` lines.

### Required Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `title` | Cover page headline, PDF metadata | `"AEM Code Sync for Edge Delivery Services"` |

### Recommended Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `subtitle` | Second line on cover, below the red divider | `"Technical Architecture and Security Documentation"` |
| `date` | Cover page and page footer | `"January 29, 2026"` |

### Optional Fields

| Field | Purpose | Example |
|-------|---------|---------|
| `author` | Author list on cover page | See structured example below |

### Minimal Example

```yaml
---
title: "AEM Code Sync for Edge Delivery Services"
subtitle: "Technical Architecture and Security Documentation"
date: "January 29, 2026"
---
```

This is the pattern used by the CaixaBank whitepaper and is sufficient for most documents. The title and subtitle appear on the cover page; the date appears on the cover and in the page footer.

### Full Example with Authors

```yaml
---
title: "AEM Code Sync for Edge Delivery Services"
subtitle: "Technical Architecture and Security Documentation"
date: "January 29, 2026"
author:
  - name: "Jane Smith"
    affiliation: "Edge Delivery Services"
  - name: "John Doe"
    affiliation: "Security Engineering"
---
```

### What the Template Renders

- **Title**: Large Adobe Clean Black text on the cover
- **Subtitle**: Lighter text below the red divider line
- **Date**: Shown on the cover and in the page footer
- **Authors**: Listed on the cover with optional affiliation

### Common Mistakes

- Putting the frontmatter after a heading or blank line (it must be the first thing in the file)
- Using unquoted strings that contain colons, e.g. `title: AEM: A Guide` -- wrap in quotes
- Adding pandoc variables like `fontsize` or `papersize` in the frontmatter -- pass those as `-V` flags to pandoc instead (the skill handles this automatically)

## Customizing the Document

The user can override pandoc variables with `-V key=value`:

| Variable | Default | Description |
|----------|---------|-------------|
| `papersize` | `a4` | Page size (`a4`, `us-letter`, etc.) |
| `fontsize` | `10pt` | Base font size |
| `template` | `adobe-whitepaper.typ` | Typst template file |
| `mainfont` | `Adobe Clean` | Main body font |

## Template Design

The template follows the Adobe Brand Guidelines and provides:
- **Adobe wordmark** centered in the lower third of the title page (red variant)
- **Adobe Clean Black** for headlines (H1), **ExtraBold** for section headlines (H2), **Bold** for subheads (H3/H4) — with -20 tracking throughout
- Adobe red (#eb1000) accent line on H2 section headings and blockquotes
- Adobe blue (#1473e6) link color
- Clean header with title/subtitle (no separator line)
- Footer with date and page numbering (hidden on title page)
- Source Code Pro for code blocks and inline code (no background on inline code)
- Automatic table of contents page with Adobe branding
- Title page with red divider line and Adobe wordmark

## Requirements

- `pandoc` must be installed (with typst PDF engine support)
- Adobe Clean fonts must be installed on the system (the skill includes copies in the fonts directory as backup)

## Troubleshooting

If fonts are not found by typst, copy the font files to a system font directory:

```bash
cp ~/.claude/skills/adobe-whitepaper/fonts/*.otf /Library/Fonts/
```

Or set the `TYPST_FONT_PATHS` environment variable:

```bash
export TYPST_FONT_PATHS=~/.claude/skills/adobe-whitepaper/fonts
```
