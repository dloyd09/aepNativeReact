// Adobe Whitepaper typst template for pandoc
// Usage: pandoc input.md -o output.pdf --pdf-engine=typst -V template=adobe-whitepaper.typ

#let conf(
  title: none,
  subtitle: none,
  authors: (),
  keywords: (),
  date: none,
  abstract: none,
  abstract-title: none,
  thanks: none,
  lang: "en",
  region: "US",
  margin: (:),
  paper: "a4",
  font: (),
  fontsize: 10pt,
  mathfont: (),
  codefont: (),
  linestretch: auto,
  sectionnumbering: none,
  pagenumbering: none,
  linkcolor: auto,
  citecolor: auto,
  filecolor: auto,
  cols: 1,
  doc,
) = {
  // Page setup
  set page(
    paper: paper,
    margin: (top: 2.8cm, bottom: 2.5cm, left: 2.5cm, right: 2.5cm),
    header: context {
      if counter(page).get().first() > 1 {
        set text(size: 8pt, fill: rgb("#888888"), font: "Adobe Clean")
        if title != none and subtitle != none {
          grid(
            columns: (1fr, 1fr),
            align(left)[#title],
            align(right)[#subtitle],
          )
        } else if title != none {
          align(left)[#title]
        }
      }
    },
    footer: context {
      if counter(page).get().first() > 1 {
        set text(size: 8pt, fill: rgb("#888888"), font: "Adobe Clean")
        line(length: 100%, stroke: 0.4pt + rgb("#cccccc"))
        v(4pt)
        grid(
          columns: (1fr, 1fr),
          align(left)[
            #if date != none [#date]
          ],
          align(right)[Page #counter(page).display() of #counter(page).final().first()],
        )
      }
    },
  )

  // Base text
  set text(
    font: "Adobe Clean",
    size: fontsize,
    fill: rgb("#333333"),
    lang: lang,
  )

  // Paragraph
  set par(
    leading: 0.75em,
    justify: true,
  )

  // Heading styles — per Adobe Brand Guidelines typography hierarchy
  // H1: Adobe Clean Black, tracking -20, leading 90%
  show heading.where(level: 1): it => {
    pagebreak(weak: true)
    v(0.3cm)
    block(
      below: 0.4cm,
      {
        set par(leading: 0.45em)
        text(size: 22pt, weight: "black", tracking: -0.02em, fill: rgb("#2c2c2c"), font: "Adobe Clean", it.body)
      }
    )
  }

  // H2: Adobe Clean ExtraBold, tracking -20, leading 110%
  show heading.where(level: 2): it => {
    v(0.4cm)
    block(
      below: 0.3cm,
      {
        line(length: 100%, stroke: 0.75pt + rgb("#eb1000"))
        v(0.15cm)
        set par(leading: 0.55em)
        text(size: 15pt, weight: "extrabold", tracking: -0.02em, fill: rgb("#2c2c2c"), font: "Adobe Clean", it.body)
      }
    )
  }

  // H3: Adobe Clean Bold, tracking -20, leading 110%
  show heading.where(level: 3): it => {
    v(0.35cm)
    block(
      below: 0.2cm,
      text(size: 12.5pt, weight: "bold", tracking: -0.02em, fill: rgb("#333333"), font: "Adobe Clean", it.body)
    )
  }

  // H4: Adobe Clean Bold, tracking -20, leading 110%
  show heading.where(level: 4): it => {
    v(0.25cm)
    block(
      below: 0.15cm,
      text(size: 11pt, weight: "bold", tracking: -0.02em, fill: rgb("#444444"), font: "Adobe Clean", it.body)
    )
  }

  // Code blocks
  show raw.where(block: true): it => {
    set text(size: 8pt, font: ("Source Code Pro", "Menlo", "Courier New"))
    block(
      fill: rgb("#f5f5f5"),
      stroke: 0.5pt + rgb("#e0e0e0"),
      inset: 10pt,
      radius: 3pt,
      width: 100%,
      it,
    )
  }

  // Inline code
  show raw.where(block: false): it => {
    text(size: 8.5pt, font: ("Source Code Pro", "Menlo", "Courier New"), it)
  }

  // Blockquotes
  show quote: it => {
    block(
      inset: (left: 12pt, top: 8pt, bottom: 8pt, right: 10pt),
      stroke: (left: 3pt + rgb("#eb1000")),
      fill: rgb("#fef7f6"),
      radius: (right: 3pt),
      width: 100%,
      text(size: 9.5pt, fill: rgb("#444444"), it.body),
    )
  }

  // Tables
  set table(
    inset: 6pt,
    stroke: 0.5pt + rgb("#dddddd"),
  )
  show table.cell.where(y: 0): set text(weight: "bold", size: 9pt, fill: rgb("#2c2c2c"))

  // Links
  show link: it => {
    set text(fill: rgb("#1473e6"))
    it
  }

  // Lists
  set list(indent: 1em, body-indent: 0.5em)
  set enum(indent: 1em, body-indent: 0.5em)

  // Section numbering
  if sectionnumbering != none {
    set heading(numbering: sectionnumbering)
  }

  // ---- Title Page ----
  set par(justify: false)

  v(2.5cm)
  align(center)[
    #block(width: 80%)[
      // Title: Adobe Clean Black per brand guidelines
      #text(size: 30pt, weight: "black", tracking: -0.02em, fill: rgb("#2c2c2c"), font: "Adobe Clean")[
        #if title != none [#title] else [Untitled Document]
      ]
      #v(0.6cm)
      #line(length: 40%, stroke: 2pt + rgb("#eb1000"))
      #v(0.6cm)
      #if subtitle != none {
        text(size: 17pt, fill: rgb("#555555"), weight: "light", font: "Adobe Clean")[
          #subtitle
        ]
      }
      #v(1.2cm)
      #if date != none or authors.len() > 0 {
        text(size: 10.5pt, fill: rgb("#777777"), font: "Adobe Clean")[
          #if date != none [*Date:* #date]
          #if authors.len() > 0 {
            linebreak()
            for author in authors [
              #author.name #if "affiliation" in author [-- #author.affiliation] \
            ]
          }
        ]
      }
    ]
  ]

  v(1fr)
  align(center)[
    #image("Adobe_Wordmark_RGB_Red.svg", height: 1.2cm)
  ]
  v(1cm)

  set par(justify: true)

  pagebreak()

  // ---- Table of Contents ----
  {
    set par(leading: 0.65em)
    text(size: 22pt, weight: "black", tracking: -0.02em, fill: rgb("#2c2c2c"), font: "Adobe Clean")[Table of Contents]
    v(0.5cm)
    outline(indent: 1em, depth: 2, title: none)
  }

  pagebreak()

  // ---- Body ----
  if cols == 1 {
    doc
  } else {
    columns(cols, doc)
  }
}
