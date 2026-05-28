# План вывода AntiMatch в продакшн

## Что уже хорошо

- Веб-клиент уже задеплоен на GitHub Pages, API — на Cloudflare Workers + D1 (всё это бесплатные тарифы). Хостить дополнительно ничего не нужно.
- 89 тестов проходят, архитектура с `GameReadModel` как контрактом — это сильная база, переделывать ядро не нужно.
- Аналитика уже есть: ивенты `round_started`, `target_consumed`, `life_lost`, `coin_collected`, `game_over` пишутся в D1. Можно сразу собирать статистику без новой инфраструктуры.
- PWA, иконки, safe-area, тач — мобильный опыт готов.

---

## Фаза 0. Заткнуть критичное (1–2 дня) — БЕЗ этого в паблик нельзя

1. **Anonymous Player Identity + Leaderboard** — кодовая часть практически закрыта и должна идти первым production-пунктом, потому что это публичная игровая петля удержания.
   - Уже сделано: публичная анонимная идентичность хранится в существующей `visitors` table как `public_color_id` + `public_name_id`, а не как готовая строка; словари вынесены во фронтовый модуль `player-public-identity`; добавлена миграция/backfill `0002_add_public_identity_and_scores.sql`; новые API `GET /players/me`, `POST /scores`, `GET /leaderboard`; leaderboard умеет открываться вокруг текущего игрока; UI показывает публичные имена, score и выделяет текущего игрока; кнопка `Топ игроков` есть на game over screen и в pause menu; технический visitor id в UI не выводится.
   - Уже дополнительно сделано: API-тесты на identity/score/leaderboard/admin/CORS/rate limit добавлены в `apps/api/test`; минимальная защита от фейковых/suspicious score submission добавлена на `POST /scores`; для `/analytics/events`, `/scores`, `/leaderboard` добавлен KV-backed fixed-window rate limiting.
   - Осталось перед продом: применить D1 migration на production, создать и привязать реальный Cloudflare KV namespace для rate limiting, задать `ADMIN_API_TOKEN` через `wrangler secret`, выставить production `CORS_ALLOWED_ORIGINS`, вручную проверить production API + web env после деплоя.
2. **Закрыть `/admin/api/*` авторизацией** — сделано в коде: middleware с Bearer token добавлен в [apps/api/src/index.ts](apps/api/src/index.ts). Осталось только задать реальный `ADMIN_API_TOKEN` через `wrangler secret put ADMIN_API_TOKEN --env production`.
3. **Сузить CORS** — сделано в коде: wildcard убран, production CORS теперь идёт через allowlist `CORS_ALLOWED_ORIGINS` в [apps/api/src/index.ts](apps/api/src/index.ts). Осталось выставить правильный origin для GH Pages/кастомного домена в production env.
4. **Rate limiting на `POST /analytics/events`, `POST /scores`, `GET /leaderboard`** — сделано в коде: добавлен KV-backed fixed-window limiter в [apps/api/src/index.ts](apps/api/src/index.ts). Осталось создать и привязать реальный Cloudflare KV namespace в `wrangler`/Cloudflare.
5. **Тесты на API** — сделано: добавлен Vitest suite в `apps/api/test` с happy-path и failure-path для `/analytics/events`, `/admin/*`, `/scores`, `/leaderboard`, включая auth/CORS/rate limit/anti-fraud сценарии.

## Фаза 1. Юридический минимум (1 день) — обязателен из-за сбора IP/UA

6. **Privacy Policy + Cookie/Analytics consent**. В D1 пишутся IP и User-Agent → это персональные данные по GDPR. Нужно: страница `/privacy`, баннер согласия (один раз, dismiss → флаг в localStorage; если отказ — не отправлять события). Сейчас этого вообще нет.
7. **Terms of Use** — простая страница, особенно если будут донаты.
8. **Data retention** — крон в Workers, чистящий `events` старше N дней. D1 free tier — 5 ГБ, но события быстро накопятся.

## Фаза 2. Подготовить продукт к показу публике (2–4 дня)

9. **README.md** на корне репо: что за игра, скриншот/гифка, ссылка играть, как запустить локально. Сейчас README нет нигде.
10. **OG-метатеги и og-image** в [apps/web/index.html](apps/web/index.html) — без них шеры в Telegram/Twitter/Discord выглядят как голая ссылка. Самый дешёвый growth.
11. **Кастомный домен** (опц.) — `antimatch.app` / `.fun` / `.io` за ~$10/год. Подключается к GH Pages бесплатно. Гораздо лучше для шеринга, чем `*.github.io/shapes-game/`.
12. **Имя финализировать** — "AntiMatch" в `<title>`, в манифесте проверить, что совпадает.
13. **i18n хотя бы EN+RU**. Сейчас UI полностью на русском — это режет аудиторию в ~50 раз. Минимум: завести `locales/{ru,en}.json`, ключи в коде. Без этого нет смысла идти на itch.io / Reddit / HN.
14. **Звук** — простейшие SFX (consume, life lost, coin) через Howler.js или Web Audio. Игра ощущается мёртвой без них. Toggle mute обязателен.
15. **Sentry (free tier)** — иначе не узнать о крашах у игроков. `@sentry/browser` + source maps в CI. Без него аналитика покажет «игрок ушёл», но не «потому что упало».

## Фаза 3. Стата и обратная связь (2 дня)

16. **Расширить событийную модель**: `app_loaded`, `first_paint`, `tutorial_completed`, `settings_changed`, `session_duration`. Сейчас события только внутри раунда — не видно воронку «зашёл → не нажал старт».
17. **Дашборд для себя**. Есть `apps/api-dev-panel`, но он показывает сырой JSON. Нужны минимум 5 цифр: DAU, средняя длина сессии, retention D1/D7, distribution финального score, % дошедших до game over. Можно или допилить dev-panel, или просто SQL-вьюхи в D1 + Grafana Cloud free.
18. **Кнопка фидбэка** в игре → форма Tally/Google Forms. Дешёвый канал сигнала «что не так».

## Фаза 4. Монетизация (по нарастанию усилий)

Реалистичная иерархия для одиночной web-аркады:

- **Самое лёгкое — донаты.** Buy Me a Coffee / Ko-fi / Boosty (для RU-аудитории). Кнопка в углу + на game over. Ожидание: $0–50/мес на маленькой аудитории, честно.
- **itch.io** — бесплатный хостинг HTML5-игр, встроенная система pay-what-you-want и tips, своя аудитория. Грузите туда сборку (та же, что для GH Pages, но проверить `base`). Хороший канал для первой обратной связи.
- **GitHub Sponsors** — если игра ассоциирована с разработчиком, не с продуктом.
- **CrazyGames / Poki / GameDistribution** — портал-агрегаторы, дают трафик и доход с межуровневых реклам (~$0.5–3 CPM). Берут долю и накладывают требования: SDK интеграция, рейтинг, ассеты в их формате. Окупается **только если планируется развивать игру дальше** — иначе долго и обидно.
- **Реклама напрямую (AdSense, AdMob web)** — на одностраничном canvas-сайте плохо одобряют. Не рекомендую как первый шаг.
- **Косметика (скины игрока) с однократной покупкой** — требует auth + Stripe + persistent профилей. Это уже большой проект (фаза 6).
- **NFT / крипта** — не надо.

Совет: **сначала itch.io + Buy Me a Coffee + кастомный домен**. Это 1 день работы и максимум сигнала.

## Фаза 5. Удержание (2–3 недели работы, делать после первых данных)

19. **Ежедневный/еженедельный режим** — seed для повторяемой генерации + отдельные сезонные результаты. Главный драйвер D7-retention в подобных играх.
20. **Туториал-сценарий** — сейчас onboarding-модалка, но не объясняет смысл «AntiMatch» (фигура должна отличаться по всем свойствам). Без этого ~50% игроков сваливаются на первом раунде.
21. **Прогрессия/анлоки** — арены, темы. Любая морковка повышает session-length.

## Фаза 6. Если игра «выстрелит» — глобальные доработки

22. **Учётки + Stripe** для косметики.
23. **Staging-окружение** — сейчас только local/prod ([apps/api/wrangler.toml](apps/api/wrangler.toml) имеет только `production`). Добавить `[env.staging]` + отдельный D1, preview-деплой web для PR через CF Pages.
24. **Доделать рефакторинг по [apps/web/TODO.md](apps/web/TODO.md)** (signals, HTML DSL, разделение systems/). До массовой аудитории не критично, но облегчит контент-апдейты.

---

## TL;DR порядок действий

1. Завершить внешний production setup для уже реализованной Фазы 0: применить D1 migration, создать/bind KV namespace, задать `ADMIN_API_TOKEN`, выставить `CORS_ALLOWED_ORIGINS`, прогнать production smoke-check API/web.
2. Privacy/Terms/consent (Фаза 1) — теперь это следующий реальный блокер.
3. README + OG + i18n EN + звук + Sentry (Фаза 2) — без этого паблик всё ещё не имеет смысла.
4. itch.io + Buy Me a Coffee + Ko-fi кнопки (Фаза 4 lite) — первая монетизация.
5. Запуск на Reddit r/WebGames, r/incremental_games, itch.io, HN Show — собрать статистику первую неделю.
