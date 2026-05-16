# Web Architecture

`apps/web` is organized by role. The important rule is that game state is exposed as plain read models, and UI modules render those models instead of reading runtime internals.

## Folders

- `src/main.ts` is the bootstrap layer. It creates DOM adapters, initializes platform services, and starts the app.
- `src/app/` contains app-level orchestration and app read-model code.
- `src/game/` contains gameplay runtime, game read-model code, game UI adapter, and canvas rendering.
- `src/settings/` contains settings state use-cases and the settings page adapter.
- `src/platform/` contains browser/platform services such as routing, PWA, analytics, and device detection.
- `src/admin/` contains the admin page and API client.

## Roles

```text
Controller = receives semantic events and decides which use-case to run.
Builder    = converts runtime state into plain read-model data.
UI adapter = renders read models and emits semantic UI events.
Runtime    = owns mutable game state, ECS entities, queues, and systems.
Platform   = wraps browser services and external integration concerns.
```

## Data Flow

```text
DOM / input events
  -> controllers / game facade
  -> runtime mutation
  -> read-model builders
  -> UI adapters / canvas renderer / tests
```

Business tests should prefer `GameReadModel` and `AppReadModel`. DOM assertions should stay limited to adapter, routing, accessibility, and smoke coverage.

## Current State

`src/game/game.ts` is still the main remaining large module. It acts as the compatibility facade and still owns gameplay systems, Planck physics adapter creation, browser input bindings, lifecycle, PWA flow, analytics hooks, and app rendering.

The next cleanup steps should keep public read-model shapes stable while moving pieces out of `game.ts`, likely in this order:

1. `planck-physics-adapter.ts`
2. shared geometry/rules helpers
3. gameplay systems
4. a smaller game runtime facade

Avoid adding new feature modules directly under `src/` unless they are true app entrypoints or shared root utilities.
