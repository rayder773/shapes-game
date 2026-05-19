# Web Architecture TODO

Этот документ фиксирует общий план улучшения `apps/web`: сначала сделать стабильную модель приложения как данные, затем переписать тесты вокруг этой модели, после этого постепенно вынести UI, почистить ECS и только потом добавлять DSL/signals как полноценный слой.

## Главная Идея

Цель не в том, чтобы сразу переписать игру на новый фреймворк. Цель в том, чтобы сначала создать стабильную границу между бизнес-состоянием игры и способом отображения.

После этого должно быть неважно, чем описан UI: чистым DOM, своим DSL, Vue-like signals, Pixi, canvas 2D или другим renderer-ом. Тесты бизнес-логики должны проверять модель данных, а не DOM/canvas/miniplex-внутренности.

## Исходный План

### 1. Стабильная Read Model

Сделать модель состояния игры/приложения как обычные данные:

- `state`: текущее состояние игры (`boot`, `playing`, `paused`, `gameOver`).
- `hud`: счет, монеты, жизни, максимальные жизни, лучший счет.
- `scene`: список видимых игровых entity.
- `overlay`: текущий режим overlay (`onboarding`, `pause`, `gameOver`, `install`, `null`).
- `roundResult`: данные результата раунда.
- `settings`: состояние настроек.
- `gameplayProfile`: активные игровые параметры.
- `input`: текущее состояние ввода.

Entity в модели должны иметь стабильный публичный формат, а не напрямую отражать ECS/physics:

- `id`
- `kind`: `player`, `target`, `lifePickup`, `coinPickup`
- `position`: world-координаты `{ x, y }`
- `rotation`
- `appearance`
- `movementDirection`
- `collisionRadius`

Legacy-поля вроде `transform`, `physics`, `player`, `target`, `lifePickup`, `coinPickup` можно временно держать для совместимости тестов, но новые тесты должны постепенно уходить на `kind`, `position`, `collisionRadius`, `hud`, `scene`, `roundResult`.

### 2. Тесты Поверх Модели

Переписать тесты так, чтобы бизнес-поведение проверялось через read model:

- score/lives/coins через `gameModel().hud`;
- позиции и объекты сцены через `gameModel().scene.entities`;
- игрок и цели через helpers вроде `playerModel()` и `targetModels()`;
- результаты раунда через `gameModel().roundResult`;
- settings через `gameModel().settings` или `settingsModel()`.

DOM assertions оставить только там, где проверяется именно DOM/UI adapter:

- видимость страниц;
- наличие canvas;
- accessibility labels;
- smoke-проверки renderer-а;
- отображение конкретных DOM-элементов, если это отдельная UI-задача.

### 3. Вынести UI Из Игры

После стабилизации модели вынести работу с интерфейсом в отдельные модули:

- HUD renderer;
- overlay renderer;
- settings page adapter;
- canvas renderer;
- route/app shell adapter.

Игра не должна напрямую знать про DOM. UI не должен знать игровые правила. Связь должна идти через модель и события:

```ts
ui.render(gameModel);
ui.onEvent((event) => app.dispatch(event));
```

### 4. Почистить ECS Архитектуру

После отделения UI и модели можно постепенно разложить текущий `game.ts`:

- `components.ts` — обычные data-компоненты;
- `resources.ts` — состояние мира: score, input, profile, round, queues;
- `systems/` — input, movement, collision, scoring, spawn, physics, read-model;
- `world.ts` — создание мира, queries/resources, dispatch событий.

Системы не обязательно должны вызываться все на каждый кадр. Часть систем может подписываться на события/signals:

- input events;
- collision events;
- settings changes;
- route changes;
- frame/tick events для physics/movement/render.

### 5. Signals Runtime

Сделать небольшой собственный reactive runtime:

- `signal(value)`;
- `computed(fn)`;
- `effect(fn)`;
- `subscribe(listener)`;
- batch/update queue при необходимости.

Signals должны стать механизмом связи между state/model/UI/systems, но не должны заставлять всю игру искусственно быть purely reactive. Физика и движение все равно могут жить на `frame` signal.

### 6. HTML DSL

После появления модели и signals можно делать DSL для UI:

```ts
div({ class: "hud" },
  p(() => `Счет: ${score.get()}`),
  button({ onclick: pause }, "Пауза"),
);
```

DSL должен быть render adapter-ом, а не фундаментом приложения. Если DSL заменить на чистый DOM или другой UI-подход, модель и бизнес-тесты не должны меняться.

## Что Уже Сделано

### Read Model

- Создан модуль `src/game/game-read-model.ts`.
- Добавлена `GameReadModel` с основными секциями:
  - `state`
  - `hud`
  - `overlay`
  - `scene`
  - `roundResult`
  - `gameplayProfile`
  - `input`
  - `settings`
- Добавлена модель entity с:
  - `id`
  - `kind`
  - `position`
  - `rotation`
  - `appearance`
  - `movementDirection`
  - `collisionRadius`
- Legacy compatibility-поля удалены из публичной модели:
  - entity больше не отдает `transform`, `physics`, `player`, `target`, `lifePickup`, `coinPickup`;
  - top-level alias-поля вроде `score`, `coins`, `lives`, `entities`, `lastRoundFinalScore` больше не входят в `GameReadModel`.

### Game Runtime Bridge

- В `src/game/game.ts` добавлены read-model exports:
  - `getGameReadModel()`
  - `getSettingsReadModel()`
  - `getPlayerModel()`
  - `getTargetModels()`
  - `getLifePickupModels()`
  - `getCoinPickupModels()`
- `getGameReadModel()` собирает модель из текущего runtime без изменения поведения игры.
- `collisionRadius` заполняется из текущего physics radius, но выставляется как смысловое поле модели.

### Test API

- `vitest.config.ts` упрощен: тестовый hook больше не собирает snapshot вручную через `game.queries`, а вызывает read-model exports.
- `window.__ANTI_MATCH_TEST__` пока сохранен как compatibility bridge.
- Добавлен метод `model()` в test API.
- `snapshot()` удален из test API; тесты используют `model()` / `gameModel()`.

### Test Helpers

- В `test/helpers.ts` добавлены helpers:
  - `model()`
  - `gameModel()`
  - `sceneEntities()`
  - `playerModel()`
  - `targetModels()`
  - `settingsModel()`
- `playerModel()` теперь корректно падает, если игрок отсутствует.
- `sceneEntities()` читает гарантированное `gameModel().scene.entities` без лишнего non-null assertion.

### Тесты

- Добавлен `test/read-model.spec.ts` для проверки контракта модели.
- Gameplay/results/settings/device/onboarding/routing/canvas tests переведены на read model там, где проверяется бизнес-поведение.
- Координаты в тестах движения переведены с legacy `transform.x/y` на `position.x/y`.
- Проверки радиуса столкновений переведены с `physics.radius` на `collisionRadius`.
- DOM assertions оставлены там, где они проверяют отображение, UI adapter или app shell.
- Results coverage разделен на business/model checks и overlay DOM checks.

### Проверки

- `npm run test --workspace web` проходит.
- `npm run lint --workspace web` проходит.
- `npm run build --workspace web` проходит.
- На момент последней проверки: 12 test files passed, 41 tests passed.

### App-Level Model

- Создан `src/app/app-read-model.ts` с типами `AppReadModelShell` и `AppReadModel`.
- В `src/game/game.ts` добавлен `export function getAppReadModel()`, агрегирующий `route` + `game` + `shell`.
- В тест-бридж (`vitest.config.ts`) добавлен `appModel: () => getAppReadModel()`.
- В `src/vite-env.d.ts` добавлены типы `AntiMatchAppShell`, `AntiMatchAppSnapshot`, поле `appModel` в `AntiMatchTestApi`.
- В `test/helpers.ts` добавлен хелпер `appModel()`.
- `test/app-shell-and-routing.spec.ts` переведён с DOM-проверок видимости на `appModel().route` и `appModel().shell.*`.

### UI Adapter Increment

- Добавлен `src/game/dom-game-ui.ts` как первый DOM adapter для game UI.
- Adapter валидирует DOM-элементы canvas/HUD/overlay и наружу отдает:
  - `render(model: AppReadModel)`;
  - `subscribe(listener)` для semantic UI events.
- `GameReadModel.overlay` расширен:
  - сохранено `mode`;
  - добавлено `view`;
  - overlay buttons теперь несут semantic `action`, например `resume`, `restart`, `acceptOnboarding`, `openSettings`, `confirmInstall`, `dismissInstall`.
- `src/game/game.ts` больше не рендерит HUD/overlay напрямую:
  - удалены прямые `updateHud()`, `renderOverlay()`, `hideOverlay()` DOM-операции;
  - runtime меняет игровое состояние и вызывает `renderApp()`;
  - `renderApp()` строит `getAppReadModel()` и передает снимок в `ui.render(model)`.
- DOM layer больше не является source of truth:
  - игровая истина остается в `game.ts`;
  - adapter держит только transient UI state для pulse/count-up/burst-анимаций.
- Route visibility оставлена app-level моделью:
  - `AppReadModel.shell.gamePageVisible` управляет `app-hidden` для canvas/HUD/overlay;
  - settings/admin UI не входили в этот инкремент.
- PWA install overlay включен в read model через active PWA overlay state.
- DOM smoke/assertions сохранены, read-model tests дополнены проверками `overlay.view` и semantic actions.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### UI Adapter Contract

- Добавлен отдельный `test/dom-game-ui.spec.ts`.
- Тест напрямую создает DOM adapter на markup из `index.html`.
- Тест передает fake `AppReadModel` в `ui.render(model)` без запуска `main.ts` и gameplay runtime.
- Зафиксированы проверки:
  - HUD rendering;
  - overlay rendering для onboarding/pause/gameOver;
  - route visibility через `app-hidden`;
  - emitted events для pause button и overlay buttons;
  - results view без зависимости от runtime physics.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### UI Adapter Boundary

- `src/game/game.ts` больше не создает `createDomGameUi()` напрямую.
- `src/game/game.ts` больше не делает direct `document.getElementById("game")` и `canvas.getContext("2d")` на import.
- Добавлен тип `GameDomDependencies`.
- `initializeGame(dependencies)` получает:
  - `canvas`;
  - `context`;
  - `ui`;
  - `rootStyle`.
- `main.ts` стал bootstrap layer для DOM-зависимостей игры:
  - валидирует canvas;
  - создает 2D context;
  - создает DOM game UI adapter;
  - передает зависимости в `initializeGame(...)`.
- Runtime listener bindings для UI/canvas/window/document перенесены в initialization path, а не выполняются при import `game.ts`.
- Keyboard/pointer/resize/fullscreen guards на этом этапе еще оставались в runtime.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### App Shell And Settings UI Boundary

- Добавлен `src/app/dom-app-ui.ts` как app-level DOM adapter.
- App UI adapter рендерит из `AppReadModel`:
  - game UI через существующий `DomGameUi`;
  - settings page visibility/state;
  - admin page visibility;
  - `document.body.dataset.route`.
- `src/settings/settings-page.ts` переведен на adapter-style contract:
  - `render(model: AppReadModel)`;
  - `subscribe(listener)` с semantic events `settings-change`, `settings-reset`, `settings-save`.
- `main.ts` больше не передает settings callbacks в constructor и не выставляет settings visibility напрямую:
  - settings events мапятся в `updateSettingsDraft`, `resetSettingsDraftToDefaults`, `persistActiveProfileSettings`;
  - route changes рендерятся через `appUi.render(getAppReadModel())`.
- Добавлен `test/settings-page.spec.ts`, который проверяет settings adapter без запуска gameplay runtime.
- Admin page оставлен без глубокого рефакторинга, только подключен к app-level visibility.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### App Controller Boundary

- Добавлен `src/app/app-controller.ts` как тонкий слой orchestration между router/settings UI/game API.
- `main.ts` стал bootstrap layer:
  - создает DOM adapters;
  - инициализирует game dependencies;
  - запускает `initializeAppController(...)`.
- В controller перенесены:
  - route entry handling (`enterGamePage`, `enterSettingsPage`, `enterNonGamePage`);
  - settings UI event handling;
  - `setOpenSettingsListener`;
  - подписка на settings state;
  - router initialization/subscription;
  - app-level render через `appUi.render(getAppReadModel())`.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Settings Controller Boundary

- Добавлен `src/settings/settings-controller.ts` как владелец settings state operations.
- Из `src/game/game.ts` вынесены:
  - settings listeners/subscription;
  - `updateSettingsDraft`;
  - `resetSettingsDraftToDefaults`;
  - `persistActiveProfileSettings`.
- `src/game/game.ts` конфигурирует settings controller через dependencies:
  - `getSettingsEntity`;
  - callback после сохранения активного профиля, который обновляет gameplay profile и помечает следующий заход на game route как restart.
- `src/app/app-controller.ts` теперь импортирует settings use-cases из `src/settings/settings-controller.ts`, а не из `src/game/game.ts`.
- Добавлен `test/settings-controller.spec.ts` для проверки draft updates, coupling lives fields, reset, persist и subscriber notifications без DOM/game runtime.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Gameplay Profile Boundary

- Добавлен `src/game/gameplay-profile.ts` как владелец profile/defaults/settings sync логики.
- Из `src/game/game.ts` вынесены:
  - default desktop/compactTouch profile creation;
  - active profile key calculation;
  - conversion `GameplayProfile` -> editable settings values;
  - saved override application;
  - settings entity initialization from saved settings;
  - profile/settings sync on viewport/device changes.
- `src/game/game.ts` теперь вызывает profile service:
  - `createGameplayProfile` для runtime dependency;
  - `createSettingsEntityFromSavedSettings(...)` при initialization;
  - `syncSettingsStateWithProfile(...)` и `resolveGameplayProfile(...)` при profile update.
- Добавлен `test/gameplay-profile.spec.ts` для проверки desktop/phone defaults, saved overrides и sync active profile changes без gameplay runtime.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Canvas Renderer Boundary

- Добавлен `src/game/canvas-renderer.ts` с внутренним API:
  - `createCanvasRenderer({ context, scale })`;
  - `CanvasRenderableEntity`;
  - `CanvasRendererMetrics`.
- Canvas renderer теперь отвечает за `clearRect` и drawing:
  - shape tracing;
  - player marker;
  - life/coin pickup drawing;
  - colors, line dash и invulnerability visual.
- `src/game/game.ts` оставляет у себя resize, viewport metrics, physics bounds, input и fullscreen guards.
- `src/game/game.ts` мапит `game.queries.renderables` в узкий renderer DTO:
  - `id`;
  - `kind`;
  - `position`;
  - `rotation`;
  - `appearance`.
- Transient visuals передаются через явные dependencies/callbacks:
  - `now()`;
  - `isDamageInvulnerable(entity)`.
- `GameReadModel.scene` и публичный read-model contract не менялись; переход renderer-а на read model остается отдельным инкрементом.
- Добавлен `test/canvas-renderer.spec.ts`:
  - renderer очищает canvas через `clearRect`;
  - рисует player, target, lifePickup и coinPickup;
  - применяет `translate`, `rotate`, `setLineDash`;
  - invulnerability callback добавляет ожидаемые extra player visual calls.
- `test/canvas-smoke.spec.ts` оставлен как app-level smoke.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Canvas Renderer On Read Model

- `src/game/canvas-renderer.ts` теперь принимает `GameReadModelEntity` из `GameReadModel.scene.entities`.
- `CanvasRenderableEntity` сохранен как compatibility alias для текущих тестов и внешних imports.
-- `src/game/game.ts` больше не собирает canvas-specific DTO из ECS/runtime entity перед рендером.
- `renderSystem()` передает в renderer `getGameReadModel().scene.entities`.
- Runtime-only invulnerability visual остался callback-зависимостью renderer-а и не добавлен в публичную read model.
- `test/canvas-renderer.spec.ts` использует read-model-compatible entity shape.
- App-level canvas smoke coverage сохранен.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Runtime Foundation

- Добавлен `src/game/game-runtime.ts` как внутренний runtime foundation module.
- Из `src/game/game.ts` вынесены внутренние типы и factory helpers:
  - entity/resource/runtime types;
  - ECS query set;
  - canvas metrics/input/queue factories;
  - `createRuntime(dependencies)`.
- `createRuntime(...)` получает явные dependencies:
  - `createGameplayProfile(metrics)`;
  - `startRound()`;
  - `now()`.
- `src/game/game.ts` по-прежнему владеет поведением игры:
  - systems;
  - physics adapter implementation;
  - read-model builder;
  - DOM/lifecycle bindings;
  - analytics/PWA/settings integration.
- Добавлен `test/game-runtime.spec.ts`, фиксирующий:
  - default boot runtime state;
  - связь ECS world и queries;
  - отсутствие shared mutable state между runtime instances.
- Публичные `GameReadModel`, `AppReadModel`, DOM/canvas adapter APIs и gameplay behavior не менялись.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Read Model Builder Boundary

- Добавлен `src/game/game-read-model-builder.ts` как отдельный builder для публичной модели игры.
- Из `src/game/game.ts` вынесены:
  - mapping ECS/runtime entity в stable `GameReadModelEntity`;
  - сортировка `scene.entities`;
  - clone helper для публичных model values;
  - сборка `hud`, `roundResult`, `gameplayProfile`, `input`, `settings`;
  - сборка overlay view для onboarding, pause, gameOver и install.
- Добавлен `src/app/app-read-model-builder.ts` для app-level shell visibility по route.
- `src/game/game.ts` сохранен как compatibility facade:
  - `getGameReadModel()`;
  - `getAppReadModel()`;
  - `getSettingsReadModel()`;
  - `getPlayerModel()`;
  - `getTargetModels()`;
  - `getLifePickupModels()`;
  - `getCoinPickupModels()`.
- Добавлен `test/read-model-builder.spec.ts`, который проверяет builder на pure fixtures без запуска `main.ts`, DOM и gameplay loop.
- Публичный `GameReadModel`, `AppReadModel`, DOM/canvas adapter APIs и gameplay behavior не менялись.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npx tsc --noEmit` в `apps/web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Browser Input Event Boundary

- Добавлен `src/game/browser-game-input.ts` как browser input adapter.
- Adapter слушает browser events и эмитит semantic synthetic events:
  - `pause-toggle-requested`;
  - `direction-key-changed`;
  - `pointer-aim-requested`;
  - `player-boost-requested`;
  - `auto-pause-requested`;
  - `viewport-change-requested`;
  - `fullscreen-change-requested`;
  - `user-gesture`.
- `src/game/game.ts` больше не регистрирует напрямую:
  - keyboard listeners;
  - canvas `pointerdown`;
  - `blur` / `visibilitychange`;
  - viewport/fullscreen resize listeners;
  - touch/gesture/wheel guards.
- Runtime остается владельцем gameplay state:
  - `game.input` все еще хранится в runtime и попадает в read model;
  - pointer-to-direction logic остается в `game.ts`, потому что зависит от player position;
  - fullscreen retry и gameplay pause/boost application остаются game-owned.
- Добавлен `test/browser-game-input.spec.ts`, который проверяет browser-to-synthetic mapping без запуска gameplay runtime.
- Проверки после инкремента:
  - `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` проходит;
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Architecture Navigation

- Файлы в `src/` сгруппированы по ролям:
  - `src/app/` — app controller, app read model, app-level DOM UI;
  - `src/game/` — gameplay facade/runtime, read model, browser input adapter, game UI, canvas renderer, gameplay profile/settings;
  - `src/settings/` — settings controller и settings page adapter;
  - `src/platform/` — router, PWA, analytics, device detection.
- `src/main.ts`, `src/icons.ts`, `src/admin/` и `src/vite-env.d.ts` оставлены на верхнем уровне/в текущих местах, потому что это entrypoint, shared utility, отдельная feature-папка и environment types.
- Добавлен `ARCHITECTURE.md` с короткой картой ролей:
  - controller;
  - builder;
  - UI adapter;
  - runtime;
  - platform.
- Поведение игры и публичные model contracts не менялись.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Planck Physics Adapter Boundary

- Добавлен `src/game/planck-physics-adapter.ts` как Planck-specific implementation текущего `PhysicsAdapter` contract.
- `src/game/game.ts` больше не импортирует Planck runtime symbols:
  - `Box`;
  - `Circle`;
  - `Polygon`;
  - `Vec2`;
  - `World`;
  - `Body`;
  - `Contact`;
  - `FixtureDef`.
- `src/game/game.ts` создает physics через `createPlanckPhysicsAdapter()` и сохраняет gameplay ownership:
  - spawning;
  - collision resolution;
  - boost/input effects;
  - resize handling;
  - read model;
  - analytics/PWA integration.
- Добавлен `src/game/game-geometry.ts` с pure helpers:
  - `WALL_THICKNESS`;
  - `clamp`;
  - `normalizeVector`;
  - `getTriangleVertices`;
  - `getShapeRadius`.
- `PlanckBodyUserData` удален из `src/game/game-runtime.ts`; Planck user-data type теперь внутренняя деталь adapter module.
- Добавлен `test/planck-physics-adapter.spec.ts`, который фиксирует:
  - ошибку при `createDynamicBody` до `createWorld`;
  - lifecycle dynamic body create/read/destroy;
  - `setVelocity`, `getVelocity`, `setSpeedAlongDirection`;
  - `resizeBounds` с clamp dynamic bodies;
  - collision event queue и drain semantics.
- Проверки после инкремента:
  - `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` проходит;
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Gameplay Rules Boundary

- Добавлен `src/game/game-rules.ts` как pure module для collision/rules decisions.
- Из `src/game/game.ts` вынесены pure decisions:
  - проверка safe target match через `areAllPropertiesDifferent(...)`;
  - классификация пары collided entities в `CollisionEvent`;
  - stable pair key для dedupe collision events;
  - resolution `CollisionEvent` в `GameplayCommand`;
  - pass-through decision для player contacts.
- `src/game/game.ts` сохранил orchestration и side effects:
  - ECS entity lookup;
  - mutation queues;
  - gameplay state mutations;
  - physics adapter calls;
  - render calls;
  - analytics/PWA integration.
- Добавлен `test/game-rules.spec.ts`, который проверяет rules module без DOM, Planck и gameplay loop.
- Existing gameplay integration coverage сохранен через `test/gameplay-core.spec.ts`.
- Проверки после инкремента:
  - `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` проходит;
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### Spawn Boundary

- Добавлен `src/game/game-spawn.ts` как pure module для spawn decisions.
- Из `src/game/game.ts` вынесены:
  - расчет desired target count;
  - планирование `SpawnRequest[]` для normal targets и safe target fallback;
  - создание appearance для target/player, life pickup и coin pickup;
  - выбор spawn position с учетом bounds, radius, blockers и padding.
- `src/game/game.ts` сохранил ownership над применением spawn:
  - чтение ECS queries;
  - создание ECS entity;
  - создание physics body;
  - запись transform/bodyId;
  - добавление entity в world.
- Добавлен `test/game-spawn.spec.ts`, который проверяет spawn decisions без DOM, Planck и gameplay loop.
- Existing gameplay integration coverage сохранен через `test/gameplay-core.spec.ts`.
- Проверки после инкремента:
  - `./node_modules/.bin/tsc -p apps/web/tsconfig.json --noEmit` проходит;
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

## Следующие Шаги

### 1. Разделить Оставшийся Game Facade

После read model, UI/canvas и browser input boundaries можно безопасно дальше дробить `src/game/game.ts`.

Ближайшие кандидаты:

- gameplay systems — постепенно вынести physics step, velocity normalization, collision collection orchestration и spawn apply orchestration;
- lifecycle/integration boundary — отделить PWA/analytics/fullscreen/app route orchestration от gameplay systems.

Целевой формат остается:

```ts
const app = createAppRuntime(dependencies);
const ui = createDomUi(root);

app.subscribe((model) => ui.render(model));
ui.subscribe((event) => app.dispatch(event));
```

### 2. Только Потом DSL / Signals / Custom ECS

Когда модель и тесты стабилизированы:

- сделать signals runtime;
- подключить systems к signals/events;
- сделать DSL для DOM;
- экспериментировать с собственным ECS;
- заменить canvas renderer на Pixi или другой renderer без переписывания бизнес-тестов.

## Правило Для Следующих Изменений

Каждый следующий рефакторинг должен сохранять этот принцип:

> Бизнес-тесты проверяют read model. UI/render tests проверяют только adapter. Runtime internals можно менять, если модель и события остаются стабильными.
