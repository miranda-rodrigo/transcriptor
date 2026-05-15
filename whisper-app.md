# Building a Wispr-like iOS App: Realistic MVP Plan

This document is a practical plan for building an iOS app inspired by Wispr Flow, based on what we already built in OpenWhispr. It intentionally avoids unverified claims, weak assumptions, and tool hype. The goal is not to "clone Wispr" feature-for-feature. The goal is to define the fastest credible path to an iOS product that delivers useful voice dictation with AI cleanup.

---

## Executive Summary

Building a Wispr-like iOS app is feasible, but it is not a straight port of the desktop app.

What transfers well from OpenWhispr:
- product flow
- onboarding ideas
- settings model
- provider/model registry concepts
- prompt/agent concepts
- transcription history concept

What does not transfer directly:
- Electron architecture
- desktop overlay window
- global hotkeys
- system-wide auto-paste behavior
- local native binaries as currently integrated

The most realistic MVP is:
- a native iOS app in SwiftUI
- a custom keyboard extension
- cloud transcription first
- optional AI cleanup after transcription
- app container for onboarding, settings, history, billing, and diagnostics

The biggest technical risk is not the AI layer. It is the keyboard extension behavior, permissions, and input UX under iOS constraints.

---

## Product Definition

For this project, "Wispr-like" should mean:
- user can trigger voice dictation from an iOS keyboard
- spoken audio becomes cleaned-up text quickly
- text is inserted into the active text field
- user can control writing style and some basic preferences
- the app has onboarding, settings, and recent history

It should not mean, at least in v1:
- full desktop parity with OpenWhispr
- universal system overlay behavior
- advanced agent workflows
- local model selection for power users
- offline-first architecture

If we do not constrain scope this way, the project becomes much harder than it appears.

---

## Hard Constraints on iOS

These constraints should drive the design:

- A custom keyboard extension is sandboxed and has stricter memory and lifecycle limits than a normal app.
- Full Access is a major trust hurdle. If the keyboard sends audio or text to the network, users must explicitly enable it.
- Secure text fields are special cases and cannot be treated like normal inputs.
- The desktop assumptions behind OpenWhispr do not exist on iPhone:
  - no floating always-on-top dictation bubble
  - no global hotkey model
  - no unrestricted cross-app automation

Most importantly:

- We should treat "audio capture directly from the keyboard extension" as a **technical risk to validate early**, not as an assumption.

If that point fails, the UX must be redesigned around the containing app or another handoff flow.

---

## Recommended Architecture

Use a three-part architecture:

1. **Containing iOS app**
   - onboarding
   - permissions education
   - settings
   - account / subscription
   - transcription history
   - diagnostics and fallback UX

2. **Custom Keyboard Extension**
   - keyboard UI
   - mic trigger UX
   - text insertion through the system keyboard APIs
   - reads shared settings from App Group storage

3. **Backend or API layer**
   - speech-to-text
   - optional text cleanup / rewrite
   - rate limiting, analytics, abuse controls, billing support

This mirrors the real product shape much better than trying to stuff everything into the keyboard.

---

## What We Can Reuse from OpenWhispr

We already have useful product and domain work done:

- the dictation mental model
- the processing pipeline concept: speech -> transcript -> cleanup -> final text
- settings categories
- multi-provider thinking
- agent/prompt architecture
- history and onboarding patterns

What we should reuse conceptually:
- prompt design
- provider abstraction
- model registry structure
- state names and UX transitions

What we should rebuild natively:
- UI layer
- recording and permissions
- storage
- networking layer for iOS
- extension/app communication

This is not a port. It is a new client product using lessons from the desktop app.

---

## MVP Scope

The MVP should stay intentionally narrow.

### In scope

- native SwiftUI containing app
- custom keyboard extension
- onboarding that explains Full Access clearly
- one dictation trigger
- cloud transcription
- optional cleanup pass with one provider
- style presets such as `Default`, `Professional`, `Casual`
- recent transcription history
- simple settings

### Out of scope

- offline transcription
- user-selectable model marketplace
- agent command mode equivalent to desktop
- cross-device sync
- deep app-aware formatting
- advanced prompt studio
- multiple AI providers on day one

This scope is enough to test whether users actually want the product.

---

## Technology Choices

Recommended default stack for speed:

- **SwiftUI** for the containing app
- **native keyboard extension** for input
- **App Groups** for shared settings/state
- **cloud speech-to-text** for v1
- **one cleanup model/provider** for v1

Recommended product decision:

- start with a managed cloud path instead of on-device transcription

Reason:
- lower engineering complexity
- smaller app size
- fewer memory problems in the extension
- faster path to measuring real demand

On-device processing should be treated as a phase-2 optimization for privacy, cost, or latency after the basic UX works.

---

## What Not to Optimize Too Early

Three tempting ideas should not drive the first version:

### 1. Model selection

Power users like it, but most users care more about:
- speed
- accuracy
- reliability
- trust

For MVP, "one good default" is stronger than a complicated model picker.

### 2. On-device transcription

This sounds attractive, but it increases:
- memory pressure
- app size
- complexity
- device-specific behavior

It is a good future differentiator, not the best first milestone.

### 3. Fancy AI coding workflows

AI tools can help, but they do not remove the real risks:
- extension constraints
- App Store compliance
- permission UX
- device testing

Treat AI as an accelerator, not as the plan.

---

## Critical Technical Experiments

Before committing to the full build, validate these in order:

1. **Keyboard feasibility**
   - build a minimal custom keyboard extension
   - confirm text insertion UX is acceptable
   - verify globe key behavior and extension switching

2. **Audio capture path**
   - validate the exact recording flow we can legally and reliably ship
   - if direct recording in the extension is weak or blocked, define the fallback UX immediately

3. **Networked transcription path**
   - send short utterances through one cloud STT provider
   - measure perceived latency on real device and cellular/wifi

4. **Cleanup pass**
   - run one prompt-based cleanup step
   - verify it improves text more than it harms it

5. **Shared state**
   - verify App Group storage and settings sync between app and extension

If any of these fail, the product shape may need to change. This is why they should happen first.

---

## Proposed Build Order

### Phase 0: Feasibility

- create the Xcode project
- add containing app + keyboard extension targets
- implement minimal keyboard UI
- validate the input flow on device

### Phase 1: Core dictation MVP

- add onboarding
- add settings storage
- wire cloud transcription
- insert resulting text into the active field
- add loading/error states

### Phase 2: Cleanup and polish

- add one cleanup model
- add style presets
- add history
- improve latency messaging and retry behavior

### Phase 3: Commercial readiness

- add analytics
- add billing/paywall
- add privacy disclosures
- add support screens and diagnostics

### Phase 4: Advanced differentiation

- evaluate on-device transcription
- consider richer rewrite modes
- consider sync or deeper personalization

---

## Main Risks

These are the real project risks, ordered roughly by importance:

1. **Keyboard UX risk**
   - even if technically possible, the experience may feel clunky compared with the built-in keyboard

2. **Permission/trust risk**
   - users are wary of Full Access keyboards, especially with cloud processing

3. **Latency risk**
   - voice products feel broken very quickly if the round trip is slow

4. **Reliability risk**
   - keyboard extensions are less forgiving than normal apps

5. **Review/compliance risk**
   - privacy language, disclosure, and app behavior must be extremely clear

---

## Success Criteria for MVP

The MVP is successful if:

- users can complete dictation reliably from the keyboard
- median perceived turnaround feels fast enough for everyday messaging
- cleanup improves output quality without surprising rewrites
- onboarding explains permissions well enough that users enable the required access
- the extension stays stable in normal use

If these are not true, adding more models or more features will not save the product.

---

## Honest Conclusion

A Wispr-like iOS app is realistic, but only if we treat it as a native iOS product with a different shape from OpenWhispr.

The smart path is:
- build native
- validate keyboard constraints first
- start cloud-first
- keep the MVP narrow
- postpone on-device models and advanced customization

The core insight from OpenWhispr still transfers well: users want fast speech-to-text that produces polished text. But the delivery mechanism on iOS is different enough that the implementation must start from iOS constraints, not from desktop architecture.