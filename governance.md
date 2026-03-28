# App Governance Framework
> Adobe Mobile SDK Bootcamp — `aepsdk-react-native`

---

## Mission Statement

**Empower architects and developers to confidently implement Adobe Mobile SDK integrations by providing a hands-on, configurable learning environment that bridges theory and production reality.**

---

## Core Values

**Clarity over complexity**
Every feature, UI decision, and code pattern should reduce cognitive load, not add to it. If a learner has to guess, we've failed.

**Real-world fidelity**
The app should mirror production-grade patterns. No shortcuts that would mislead learners about how Adobe integrations actually behave in the field.

**Progressive disclosure**
Meet learners where they are. Surface technical depth on demand, not all at once.

**Configuration as curriculum**
The ability to plug in your own Launch tags and see live results *is* the lesson. Protect and prioritize that core loop above all else.

**Stability earns trust**
A buggy teaching tool undermines the lesson. Reliability is a feature, not a maintenance task.

---

## Governing Principles (Constitution)

### 1. The Learning Loop is Sacred
The configure → run → observe cycle is the product. Any change that breaks, complicates, or obscures that loop is a regression regardless of technical merit.

### 2. Two Audiences, One Codebase
The technical and consumer views are intentional. Architecture decisions must serve both without compromising either. Never let one side bleed complexity into the other.

### 3. Teach by Doing, Document by Being
The app itself is the primary documentation. Code should be readable enough that a learner can follow the integration logic without a guide. Comments and naming are first-class concerns.

### 4. Upstream Fidelity
Stay aligned with the official `aepsdk-react-native` SDK. Avoid patterns or workarounds that diverge from Adobe's recommended approach — the app is a reference, not a fork.

### 5. Change Slowly, Intentionally
This is a teaching tool used in structured bootcamps. Breaking changes have downstream costs on curriculum, facilitators, and learners. Stability takes priority over novelty.

### 6. Bugs are Curriculum Debt
Every unresolved bug is a distraction from learning. Triage bugs by their impact on the learning loop first, technical severity second.

---

## Roles & Responsibilities

| Role | Responsibility |
|---|---|
| **Curriculum Architect** | Owns the learning outcomes and governs the roadmap |
| **SDK Fidelity Agent** | Ensures alignment with Adobe SDK updates and best practices |
| **Experience Guardian** | Owns the learner-facing UX on both technical and consumer views |
| **Stability Steward** | Manages bug triage, regression testing, and release quality |
| **Community Bridge** | Connects bootcamp feedback back to app improvements |

---

## Decision Filter

When evaluating any change, feature request, or bug fix, ask:

1. **Does it protect the learning loop?** If no, reconsider.
2. **Does it serve both audiences?** If it only serves one, justify why.
3. **Is it aligned with Adobe SDK best practices?** If not, document the deviation.
4. **Is it stable enough for a live bootcamp?** If not, it's not ready.
5. **Would a new learner understand it without a guide?** If not, simplify or document.

---

*Maintained by the Curriculum Architect. Review annually or after major SDK updates.*