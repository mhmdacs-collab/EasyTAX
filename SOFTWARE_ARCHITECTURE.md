# SOFTWARE_ARCHITECTURE.md

# Purpose

Define the technical architecture of EasyTAX.

This document is the single source of truth for all technical decisions.

This document describes HOW the product must be implemented.

---

# Architecture Style

- Local First
- Offline First
- Feature-Based Architecture
- Plugin-Based Architecture
- Event-Driven Communication
- Repository Pattern

---

# Supported Platforms

- Progressive Web Application (PWA)
- Desktop
- Android
- iOS

Single codebase for all platforms.

---

# Core Architecture

Presentation Layer

↓

Application Layer

↓

Business Engines

↓

Repositories

↓

Local Database

↓

Synchronization Engine

↓

Cloud Database

---

# Business Engines

- Document Engine
- Calculation Engine
- QR Engine
- Validation Engine
- PDF Engine
- Notification Engine
- Synchronization Engine
- Plugin Engine

Business rules must exist only inside Business Engines.

---

# Storage Strategy

Primary Storage:
Local Database

Secondary Storage:
Cloud Database

All writes occur locally first.

Cloud synchronization runs in the background.

The application must remain fully functional without internet.

---

# Synchronization Rules

- Local data is the primary source.
- Synchronization must be automatic.
- Background synchronization only.
- Retry failed operations automatically.
- Detect synchronization conflicts.
- Resolve conflicts using predefined rules.
- Never block the user interface.

---

# Folder Strategy

Feature-Based Structure

Each Feature owns:

- Components
- Pages
- Repository
- Validation
- Types
- Tests
- README

Features communicate only through public interfaces.

---

# Plugin Architecture

Plugins are optional.

Plugins must never modify Core.

Plugins communicate only through Plugin APIs.

Plugins can be enabled or disabled without affecting Core.

---

# Security

- Organization isolation.
- Secure authentication.
- Encrypted local storage.
- Secure cloud communication.
- Secure plugin permissions.

---

# Performance Rules

- Fast startup.
- Lazy loading.
- Background synchronization.
- Background calculations.
- Minimal memory usage.

---

# AI Development Rules

AI must:

- Follow Specifications.
- Never invent architecture.
- Never duplicate business logic.
- Never bypass Business Engines.
- Never access databases directly from UI.
- Never modify unrelated Features.

---

# Architecture Constraints

Forbidden:

- Monolithic modules.
- Business logic inside UI.
- Direct database access from UI.
- Tight coupling between Features.
- Plugin dependency inside Core.
- Internet dependency.

---

# Acceptance Criteria

- Fully functional offline.
- One shared codebase.
- Independent Features.
- Independent Plugins.
- Business logic isolated inside Engines.
- Automatic synchronization.
- Scalable architecture.
- AI-friendly project structure.

---

END
