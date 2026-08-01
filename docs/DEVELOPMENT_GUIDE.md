# DEVELOPMENT_GUIDE.md

# Purpose

Define mandatory development rules for all contributors and AI coding agents.

This document defines HOW code must be written.

---

# General Rules

- Follow all Project Specifications.
- Keep code simple.
- Keep Features independent.
- Prefer readability over cleverness.
- Never duplicate business logic.
- Never violate architecture.

---

# Project Structure

The project is Feature-Based.

Each Feature owns:

- Components
- Pages
- Repository
- Validation
- Types
- Tests
- README

Shared code belongs only inside Shared modules.

---

# Naming Rules

Use descriptive names.

Avoid abbreviations.

Use English only.

Names must describe responsibility.

---

# File Rules

- One responsibility per file.
- Prefer small files.
- Split large files.
- Avoid deeply nested folders.

---

# Function Rules

- One responsibility.
- Small functions.
- Predictable output.
- No hidden side effects.

---

# UI Rules

UI displays data only.

UI never contains business logic.

UI never performs calculations.

UI never communicates directly with storage.

---

# Business Logic Rules

Business logic exists only inside Business Engines.

Allowed:

- Calculation Engine
- Validation Engine
- Document Engine
- QR Engine
- Synchronization Engine

Forbidden:

- Components
- Pages
- Dialogs

---

# Repository Rules

Repositories are the only layer allowed to access storage.

UI never accesses databases.

Business Engines never access storage directly.

---

# Validation Rules

Validation belongs only inside Validation Engine.

Validation must never be duplicated.

---

# Plugin Rules

Plugins must never modify Core.

Plugins communicate only through Plugin APIs.

Plugins must be removable without affecting Core.

---

# Testing Rules

Every Feature must include:

- Unit Tests
- Integration Tests

Critical workflows must always be tested.

---

# Security Rules

- Never trust user input.
- Always validate.
- Always sanitize.
- Never expose secrets.
- Never log sensitive information.

---

# Performance Rules

- Lazy loading.
- Background processing.
- Avoid unnecessary rendering.
- Avoid duplicated calculations.

---

# Documentation Rules

Every Feature must include its own README.md describing:

- Purpose
- Public API
- Dependencies
- Responsibilities
- Limitations

---

# AI Coding Rules

Before writing code:

- Read README.md
- Read PRODUCT_SPECIFICATION.md
- Read SOFTWARE_ARCHITECTURE.md
- Read DEVELOPMENT_GUIDE.md

AI must never:

- Invent Features.
- Invent Architecture.
- Ignore Specifications.
- Duplicate Business Logic.
- Modify unrelated Features.
- Introduce ERP concepts into Core.

If documentation conflicts:

Stop implementation and report the conflict.

---

# Code Review Checklist

Verify:

- Specification compliance.
- Architecture compliance.
- No duplicated logic.
- No business logic inside UI.
- Proper testing.
- Proper naming.
- Feature isolation.
- Plugin compatibility.

---

# Acceptance Criteria

Every Pull Request must:

- Pass tests.
- Follow Specifications.
- Preserve Architecture.
- Preserve Simplicity.
- Maintain Feature isolation.

---

# Never guess missing requirements.

If specification is missing,
stop implementation and report it.

---
END
