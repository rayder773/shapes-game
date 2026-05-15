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

- Создан модуль `src/game-read-model.ts`.
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

- В `src/game.ts` добавлены read-model exports:
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

- Создан `src/app-read-model.ts` с типами `AppReadModelShell` и `AppReadModel`.
- В `src/game.ts` добавлен `export function getAppReadModel()`, агрегирующий `route` + `game` + `shell`.
- В тест-бридж (`vitest.config.ts`) добавлен `appModel: () => getAppReadModel()`.
- В `src/vite-env.d.ts` добавлены типы `AntiMatchAppShell`, `AntiMatchAppSnapshot`, поле `appModel` в `AntiMatchTestApi`.
- В `test/helpers.ts` добавлен хелпер `appModel()`.
- `test/app-shell-and-routing.spec.ts` переведён с DOM-проверок видимости на `appModel().route` и `appModel().shell.*`.

### UI Adapter Increment

- Добавлен `src/dom-game-ui.ts` как первый DOM adapter для game UI.
- Adapter валидирует DOM-элементы canvas/HUD/overlay и наружу отдает:
  - `render(model: AppReadModel)`;
  - `subscribe(listener)` для semantic UI events.
- `GameReadModel.overlay` расширен:
  - сохранено `mode`;
  - добавлено `view`;
  - overlay buttons теперь несут semantic `action`, например `resume`, `restart`, `acceptOnboarding`, `openSettings`, `confirmInstall`, `dismissInstall`.
- `game.ts` больше не рендерит HUD/overlay напрямую:
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

### 1. Закрепить Контракт UI Adapter

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

### 1. Доделать UI Adapter Boundary

- `game.ts` больше не создает `createDomGameUi()` напрямую.
- `game.ts` больше не делает direct `document.getElementById("game")` и `canvas.getContext("2d")` на import.
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
- Keyboard/pointer/resize/fullscreen guards пока оставлены в runtime, как и планировалось.
- Проверки после инкремента:
  - `npm run test --workspace web` проходит;
  - `npm run lint --workspace web` проходит;
  - `npm run build --workspace web` проходит.

### 1. Разделить Canvas Renderer Boundary

- Добавлен `src/canvas-renderer.ts` с внутренним API:
  - `createCanvasRenderer({ context, scale })`;
  - `CanvasRenderableEntity`;
  - `CanvasRendererMetrics`.
- Canvas renderer теперь отвечает за `clearRect` и drawing:
  - shape tracing;
  - player marker;
  - life/coin pickup drawing;
  - colors, line dash и invulnerability visual.
- `game.ts` оставляет у себя resize, viewport metrics, physics bounds, input и fullscreen guards.
- `game.ts` мапит `game.queries.renderables` в узкий renderer DTO:
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

## Следующие Шаги

### 1. Разделить Game Runtime

После UI/canvas adapter boundary можно безопасно дробить `game.ts`:

- types/components;
- resources;
- systems;
- physics adapter;
- read model builder;
- analytics integration;
- app lifecycle.

### 2. Перевести Canvas Renderer На Read Model

Отдельным инкрементом можно перевести canvas renderer с DTO, собранного из runtime/ECS entity, на `GameReadModel.scene.entities`.

Целевой формат остается:

```ts
const app = createAppRuntime(dependencies);
const ui = createDomUi(root);

app.subscribe((model) => ui.render(model));
ui.subscribe((event) => app.dispatch(event));
```

### 3. Только Потом DSL / Signals / Custom ECS

Когда модель и тесты стабилизированы:

- сделать signals runtime;
- подключить systems к signals/events;
- сделать DSL для DOM;
- экспериментировать с собственным ECS;
- заменить canvas renderer на Pixi или другой renderer без переписывания бизнес-тестов.

## Правило Для Следующих Изменений

Каждый следующий рефакторинг должен сохранять этот принцип:

> Бизнес-тесты проверяют read model. UI/render tests проверяют только adapter. Runtime internals можно менять, если модель и события остаются стабильными.
