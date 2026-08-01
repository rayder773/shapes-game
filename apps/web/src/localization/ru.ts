import type { TranslationShape } from "./translation-shape.ts";
import type { EnglishTranslations } from "./en.ts";

const ru = {
  app: {
    name: "AntiMatch",
    manifestDescription: "Аркада на реакцию, где можно поглощать только фигуры, отличающиеся по всем свойствам.",
  },
  locale: { ru: "Русский", en: "English" },
  action: {
    ok: "Понятно", resume: "Продолжить", settings: "Настройки", restart: "Начать заново",
    leaderboard: "Топ игроков", install: "Установить", notNow: "Не сейчас", fullscreen: "Полный экран",
  },
  game: {
    hud: {
      score: (score: number) => `Счет: ${score}`,
      coins: "Монеты:",
      coinsAria: (coins: number) => `Монеты: ${coins}`,
      livesAria: (lives: number, maxLives: number) => `Жизни: ${lives} из ${maxLives}`,
      best: "Рекорд",
      bestAria: (score: number) => `Лучший счет: ${score}`,
    },
    pause: {
      openAria: "Поставить игру на паузу", resumeAria: "Продолжить игру", title: "Пауза",
      autoMessage: "Игра остановлена.",
    },
    rules: {
      title: "Правила",
      first: "Клик, тап или клавиши мгновенно меняют направление, скорость всегда остается постоянной.",
      second: "Съедать можно только фигуры, которые отличаются по всем трем свойствам.",
      third: "Если совпадает хотя бы одно свойство, теряется жизнь. Забег заканчивается, когда жизни кончаются.",
    },
    results: {
      title: "Результаты", baseScore: "Базовый счет", coins: "Монеты", bonus: "Бонус ×2",
      finalScore: "Итоговый результат", best: "Рекорд: ", newBest: "Новый рекорд!",
    },
  },
  settings: {
    title: "Настройки", mobileProfile: "Редактируется активный мобильный профиль.",
    desktopProfile: "Редактируется активный десктопный профиль.", language: "Язык",
    targetSpeed: "Скорость фигур", playerSpeed: "Скорость игрока", playerBoostSpeed: "Скорость скачка",
    maxTargets: "Максимум фигур", targetGrowthScoreStep: "Шаг увеличения фигур",
    lifeSpawnChancePercent: "Шанс появления жизни", coinSpawnChancePercent: "Шанс появления монетки",
    lifePickupLifetimeSeconds: "Время жизни жизни", coinPickupLifetimeSeconds: "Время жизни монетки",
    startLives: "Начальное количество жизней", maxLives: "Максимум жизней",
    seconds: (value: number) => `${value} сек`, reset: "Дефолтные значения", save: "Сохранить и начать игру",
  },
  leaderboard: {
    title: "Топ игроков", closeAria: "Закрыть таблицу лидеров", loading: "Загрузка...",
    loadFailed: "Не удалось загрузить топ игроков.",
    notConfigured: "Топ игроков будет доступен после подключения API.",
    empty: "Пока нет результатов. Заверши раунд, чтобы попасть в топ.",
    noNeighbors: "Пока нет соседних результатов.", bestResults: "Лучшие результаты",
    currentRank: (rank: number) => `Твоя позиция: #${rank}`, you: "Ты",
  },
  auth: {
    title: "Сохранить прогресс", intro: "Один рекорд на всех ваших устройствах.",
    connectedTitle: "Прогресс синхронизирован", connectedHint: "Рекорд сохранён в этом Google-аккаунте.",
    signedIn: "Аккаунт Google",
    signingIn: "Входим...", logout: "Выйти", deleteAccount: "Удалить аккаунт",
    deleteConfirm: "Удалить игровой Google-аккаунт и общий рекорд? Это действие нельзя отменить.",
    sdkError: "Не удалось загрузить Google Sign-In.", signInError: "Не удалось войти через Google.",
    offlineError: "Нет сети. Текущий матч не пострадает.", deleteError: "Не удалось удалить аккаунт.",
  },
  pwa: {
    postGameMessage: "Установите AntiMatch, чтобы возвращаться в новый матч в один тап и играть без лишней браузерной обвязки.",
    pauseMessage: "Установите игру, чтобы запускать ее как отдельное приложение и быстрее возвращаться в матч.",
    postGameTipOne: "Открывается как отдельное приложение.",
    postGameTipTwo: "После первого запуска матч доступен даже без сети.",
    pauseTipOne: "Работает как отдельное приложение без адресной строки.",
    pauseTipTwo: "После первого запуска игра открывается даже без сети.",
    iosMessage: "На iPhone установка работает через Safari: откройте меню Поделиться и выберите «На экран Домой».",
    iosTipOne: "Откройте игру именно в Safari.", iosTipTwo: "Нажмите Поделиться.",
    iosTipThree: "Выберите «На экран Домой» / Add to Home Screen.", howToInstall: "Как установить",
    iosInlineMessage: "Можно добавить игру на экран Домой и запускать ее как приложение.",
    installInlineMessage: "Можно установить игру и возвращаться в следующий матч одним тапом.",
  },
  admin: {
    title: "Админка", brand: "Shapes Game", refresh: "Обновить", loading: "Загрузка",
    users: "Пользователи", user: "Пользователь", events: "События", lastActivity: "Последняя активность",
    created: "Создан", actions: "Действия", type: "Тип", clientTime: "Время клиента",
    ip: "IP", userAgent: "User-Agent", id: "ID", payload: "Payload",
    confirmDelete: (user: string) => `Удалить пользователя ${user} и все его события?`,
    loadingUsers: "Загружаем пользователей...", noUsers: "Пользователей пока нет.", noIp: "нет IP",
    noUserAgent: "нет user-agent", noEvents: "нет событий", deleting: "Удаляем", delete: "Удалить",
    selectUser: "Выберите пользователя.", loadingEvents: "Загружаем события...",
    userHasNoEvents: "У пользователя пока нет событий.", loadingMoreEvents: "Загружаем еще события...",
    scrollForMore: "Прокрутите ниже, чтобы загрузить еще.", allEventsLoaded: "Все события загружены.",
    unknownError: "Неизвестная ошибка", readOnly: "Только просмотр",
    error: { loadUsers: "Не удалось загрузить пользователей", loadEvents: "Не удалось загрузить события пользователя", deleteUser: "Не удалось удалить пользователя" },
  },
} satisfies TranslationShape<EnglishTranslations>;

export default ru;
