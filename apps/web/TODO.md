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
- Временно сохранены compatibility-поля:
  - `transform`
  - `physics`
  - `player`
  - `target`
  - `lifePickup`
  - `coinPickup`
  - старые top-level поля snapshot-а вроде `score`, `coins`, `lives`, `entities`, `lastRoundFinalScore`.

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
- `snapshot()` оставлен как alias на модель для плавной миграции.

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
- Gameplay/results/settings/device/onboarding/routing/canvas tests частично переведены на модель.
- Координаты в тестах движения переведены с legacy `transform.x/y` на `position.x/y`.
- Проверки радиуса столкновений переведены с `physics.radius` на `collisionRadius`.
- DOM assertions пока оставлены там, где они проверяют отображение или app shell.

### Проверки

- `npm run test --workspace web` проходит.
- На момент последней проверки: 11 test files passed, 36 tests passed.

## Следующие Шаги

### 1. Дочистить Тесты От Legacy Snapshot

- Постепенно заменить оставшиеся обращения к legacy-полям:
  - `state.score` -> `state.hud.score`
  - `state.coins` -> `state.hud.coins`
  - `state.lives` -> `state.hud.lives`
  - `state.entities` -> `state.scene.entities`
  - marker flags `player/target/lifePickup/coinPickup` -> `kind`
  - `transform` -> `position` + `rotation`
  - `physics.radius` -> `collisionRadius`
- Оставить legacy-поля до тех пор, пока все тесты не будут переведены.

### 2. Сузить DOM Assertions

- В gameplay tests убрать DOM-проверки вроде текста HUD, если они проверяют бизнес-логику.
- Перенести DOM-specific expectations в отдельные UI/shell tests.
- Canvas smoke оставить как renderer smoke, а не как gameplay test.

### 3. Сделать App-Level Model

Текущая модель game-oriented. Позже можно добавить `AppModel`:

- `route`
- `game`
- `settingsPage`
- `adminPage`
- `shell`

Так роутинг и страницы тоже смогут тестироваться через модель, а не через DOM напрямую.

### 4. Вынести UI Adapter

После стабилизации tests/read model вынести из `game.ts`:

- DOM lookups;
- HUD rendering;
- overlay rendering;
- canvas rendering;
- button event bindings.

Целевой формат:

```ts
const app = createAppRuntime(dependencies);
const ui = createDomUi(root);

app.subscribe((model) => ui.render(model));
ui.subscribe((event) => app.dispatch(event));
```

### 5. Разделить Game Runtime

После UI adapter можно безопасно дробить `game.ts`:

- types/components;
- resources;
- systems;
- physics adapter;
- read model builder;
- analytics integration;
- app lifecycle.

### 6. Только Потом DSL / Signals / Custom ECS

Когда модель и тесты стабилизированы:

- сделать signals runtime;
- подключить systems к signals/events;
- сделать DSL для DOM;
- экспериментировать с собственным ECS;
- заменить canvas renderer на Pixi или другой renderer без переписывания бизнес-тестов.

## Правило Для Следующих Изменений

Каждый следующий рефакторинг должен сохранять этот принцип:

> Бизнес-тесты проверяют read model. UI/render tests проверяют только adapter. Runtime internals можно менять, если модель и события остаются стабильными.