# CONTRIBUTING & ONBOARDING — Job-Finder

Welcome to Job-Finder! This document serves as the onboarding guide for human developers and AI agents contributing to this repository for the first time.

---

## 1. Quick Start Developer Flow

1. **Bootstrap Dependencies**:
   - Web: `npm install`
   - Flutter: `melos bootstrap`
2. **Environment Setup**:
   - Copy `.env.example` to `.env`
   - Fill in your local environment credentials.
3. **Local Run**:
   - Web: `npm run dev`
   - Flutter: `flutter run --dart-define-from-file=.env.development`

---

## 2. Directory Layout Map

[Provide a visual tree of the repository module folders and their primary purposes here]

---

## 3. Code Standards & Pull Requests

- **Branch Protection**: You must work in a feature branch (`feature/...` or `fix/...`). Direct commits to `main` are blocked.
- **Testing Requirements**:
  - Web target: Unit tests required for utility code and hooks.
  - Flutter target: Unit tests required for Riverpod providers and repositories.
- **Merge Gate Checklist**:
  - Run static analysis gates (lint, build compiles cleanly, tests pass).
  - Submit the PR link for human review and squashed merge.

---

## 4. Master Guidelines References

All contributors must review and align with the following global playbooks:
- Master Handbooks: `~/.gemini/config/AGENTS.md`
- Dependency Rules: `.agents/DEPENDENCY_POLICY.md`
- Design Guidelines: `.agents/DESIGN_DNA.md` or `.agents/FLUTTER_DESIGN_DNA.md`
- Rollbacks & Ops: `~/.gemini/config/COMPLIANCE_OBSERVABILITY_POLICY.md`
