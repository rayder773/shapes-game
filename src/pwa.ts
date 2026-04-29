import { registerSW } from "virtual:pwa-register";
import { isPhoneDevice } from "./device.ts";

const SW_RELOAD_SESSION_KEY = "anti-match.swControllerReloaded";
const INSTALL_PROMPT_DISMISS_COUNT_KEY = "anti-match.installPromptDismissCount";
const INSTALL_PROMPT_DISMISSED_AT_KEY = "anti-match.installPromptDismissedAt";
const INSTALL_PROMPT_INSTALLED_KEY = "anti-match.installPromptInstalled";
const INSTALL_PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const INSTALL_PROMPT_MAX_AUTO_DISMISSALS = 2;
const IOS_USER_AGENT_PATTERN = /iPhone|iPod/i;
const SAFARI_EXCLUSION_PATTERN = /CriOS|FxiOS|EdgiOS|OPiOS|DuckDuckGo|YaBrowser|Instagram|FBAN|FBAV/i;
const PWA_STATE_CHANGE_EVENT = "anti-match:pwa-state-change";

type BeforeInstallPromptChoice = {
  outcome: "accepted" | "dismissed";
  platform: string;
};

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<BeforeInstallPromptChoice>;
};

type InstallOverlayVariant = "prompt" | "iosHint";
type InstallSurface = "pause" | "postGameOver";

export type PwaInstallOverlayModel = {
  variant: "prompt" | "iosHint";
  surface: "pause" | "postGameOver";
  title: string;
  message: string;
  tips: string[];
  primaryLabel: string;
  secondaryLabel: string | null;
};

export type PwaInlineInstallPrompt = {
  buttonLabel: string;
  message: string;
};

export type PwaOverlayViewModel = {
  layout: "modal" | "sheet";
  variant: "default" | "ios-hint";
  title: string;
  message: string;
  tips: string[];
  primaryLabel: string;
  secondaryLabel: string | null;
};

export type PwaActionResult =
  | { type: "none" }
  | { type: "show-install-overlay"; overlay: PwaInstallOverlayModel }
  | { type: "restore"; target: "pause" | "gameOver" | "hide" };

export type PwaController = {
  initialize(): void;
  setGameRouteActive(active: boolean): void;
  getPauseInstallButtonState(): { visible: boolean; label: string };
  consumeGameOverInstallPrompt(): PwaInlineInstallPrompt | null;
  openInstallFlow(surface: "pause" | "postGameOver"): Promise<PwaActionResult>;
  confirmOverlay(): Promise<PwaActionResult>;
  dismissOverlay(): PwaActionResult;
};

type InstallPromoState = {
  installAvailable: boolean;
  installDismissCount: number;
  installDismissedAt: number | null;
  hasSeenInstallAutoPrompt: boolean;
  activeOverlay: PwaInstallOverlayModel | null;
};

export function registerPwaServiceWorker(): void {
  if (!("serviceWorker" in navigator)) {
    return;
  }

  sessionStorage.removeItem(SW_RELOAD_SESSION_KEY);

  let hasReloadedForControllerChange = false;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (hasReloadedForControllerChange || sessionStorage.getItem(SW_RELOAD_SESSION_KEY) === "true") {
      return;
    }

    hasReloadedForControllerChange = true;
    sessionStorage.setItem(SW_RELOAD_SESSION_KEY, "true");
    window.location.reload();
  });

  const updateServiceWorker = registerSW({
    immediate: true,
    onRegisteredSW(_swUrl, registration) {
      void registration?.update();
    },
    onNeedRefresh() {
      void updateServiceWorker(true);
    },
    onRegisterError(error) {
      console.error("Service worker registration failed", error);
    },
  });

  void updateServiceWorker();
}

export function createPwaController(): PwaController {
  let pendingInstallPromptEvent: BeforeInstallPromptEvent | null = null;
  let isGameRouteActive = false;
  let hasInitialized = false;
  const installPromoState: InstallPromoState = {
    installAvailable: false,
    installDismissCount: getInstallPromptDismissCount(),
    installDismissedAt: getInstallPromptDismissedAt(),
    hasSeenInstallAutoPrompt: false,
    activeOverlay: null,
  };

  function emitStateChange(): void {
    window.dispatchEvent(new CustomEvent(PWA_STATE_CHANGE_EVENT));
  }

  function syncInstallAvailability(): void {
    installPromoState.installAvailable =
      isPhoneDevice() &&
      isGameRouteActive &&
      !isInstallPromptInstalled() &&
      (pendingInstallPromptEvent !== null || isIphoneSafari());
  }

  function markInstallPromptInstalled(): void {
    window.localStorage.setItem(INSTALL_PROMPT_INSTALLED_KEY, "true");
    window.localStorage.removeItem(INSTALL_PROMPT_DISMISS_COUNT_KEY);
    window.localStorage.removeItem(INSTALL_PROMPT_DISMISSED_AT_KEY);
    pendingInstallPromptEvent = null;
    installPromoState.installDismissCount = 0;
    installPromoState.installDismissedAt = null;
    installPromoState.installAvailable = false;
    installPromoState.activeOverlay = null;
  }

  function markInstallPromptDismissed(): void {
    const nextDismissCount = installPromoState.installDismissCount + 1;
    const dismissedAt = Date.now();

    installPromoState.installDismissCount = nextDismissCount;
    installPromoState.installDismissedAt = dismissedAt;
    installPromoState.activeOverlay = null;
    window.localStorage.setItem(INSTALL_PROMPT_DISMISS_COUNT_KEY, String(nextDismissCount));
    window.localStorage.setItem(INSTALL_PROMPT_DISMISSED_AT_KEY, String(dismissedAt));
  }

  function canShowInstallCta(): boolean {
    return installPromoState.installAvailable;
  }

  function isInstallPromptCooldownActive(): boolean {
    const dismissedAt = installPromoState.installDismissedAt;
    if (dismissedAt === null) {
      return false;
    }

    return Date.now() - dismissedAt < INSTALL_PROMPT_COOLDOWN_MS;
  }

  function getRestoreTarget(surface: InstallSurface): "pause" | "gameOver" {
    return surface === "postGameOver" ? "gameOver" : "pause";
  }

  function createOverlayModel(variant: InstallOverlayVariant, surface: InstallSurface): PwaInstallOverlayModel {
    if (variant === "prompt") {
      return {
        variant,
        surface,
        title: "AntiMatch",
        message:
          surface === "postGameOver"
            ? "Установите AntiMatch, чтобы возвращаться в новый матч в один тап и играть без лишней браузерной обвязки."
            : "Установите игру, чтобы запускать ее как отдельное приложение и быстрее возвращаться в матч.",
        tips:
          surface === "postGameOver"
            ? [
                "Открывается как отдельное приложение.",
                "После первого запуска матч доступен даже без сети.",
              ]
            : [
                "Работает как отдельное приложение без адресной строки.",
                "После первого запуска игра открывается даже без сети.",
              ],
        primaryLabel: "Установить",
        secondaryLabel: "Не сейчас",
      };
    }

    return {
      variant,
      surface,
      title: "AntiMatch",
      message: "На iPhone установка работает через Safari: откройте меню Поделиться и выберите «На экран Домой».",
      tips: [
        "Откройте игру именно в Safari.",
        "Нажмите Поделиться.",
        "Выберите «На экран Домой» / Add to Home Screen.",
      ],
      primaryLabel: "Понятно",
      secondaryLabel: null,
    };
  }

  function createInlineInstallPrompt(variant: InstallOverlayVariant): PwaInlineInstallPrompt {
    if (variant === "iosHint") {
      return {
        buttonLabel: "Как установить",
        message: "Можно добавить игру на экран Домой и запускать ее как приложение.",
      };
    }

    return {
      buttonLabel: "Установить",
      message: "Можно установить игру и возвращаться в следующий матч одним тапом.",
    };
  }

  async function runInstallPrompt(surface: InstallSurface): Promise<PwaActionResult> {
    const installPromptEvent = pendingInstallPromptEvent;
    if (!installPromptEvent) {
      installPromoState.activeOverlay = null;
      return { type: "restore", target: getRestoreTarget(surface) };
    }

    pendingInstallPromptEvent = null;

    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;

      if (choice.outcome === "accepted") {
        markInstallPromptInstalled();
      } else {
        markInstallPromptDismissed();
      }
    } catch {
      pendingInstallPromptEvent = installPromptEvent;
    } finally {
      syncInstallAvailability();
      emitStateChange();
    }

    return { type: "restore", target: getRestoreTarget(surface) };
  }

  return {
    initialize(): void {
      if (hasInitialized) {
        return;
      }

      hasInitialized = true;

      window.addEventListener("beforeinstallprompt", (event) => {
        event.preventDefault();
        pendingInstallPromptEvent = event as BeforeInstallPromptEvent;
        syncInstallAvailability();
        emitStateChange();
      });

      window.addEventListener("appinstalled", () => {
        markInstallPromptInstalled();
        syncInstallAvailability();
        emitStateChange();
      });
    },

    setGameRouteActive(active: boolean): void {
      isGameRouteActive = active;
      syncInstallAvailability();
      emitStateChange();
    },

    getPauseInstallButtonState(): { visible: boolean; label: string } {
      return {
        visible: canShowInstallCta(),
        label: "Установить",
      };
    },

    consumeGameOverInstallPrompt(): PwaInlineInstallPrompt | null {
      const canPresentInstallFlow = pendingInstallPromptEvent !== null || isIphoneSafari();

      if (
        !canShowInstallCta() ||
        !canPresentInstallFlow ||
        installPromoState.installDismissCount >= INSTALL_PROMPT_MAX_AUTO_DISMISSALS ||
        installPromoState.hasSeenInstallAutoPrompt ||
        isInstallPromptCooldownActive()
      ) {
        return null;
      }

      installPromoState.hasSeenInstallAutoPrompt = true;
      return createInlineInstallPrompt(pendingInstallPromptEvent ? "prompt" : "iosHint");
    },

    async openInstallFlow(surface: "pause" | "postGameOver"): Promise<PwaActionResult> {
      if (!canShowInstallCta()) {
        return { type: "none" };
      }

      if (isIphoneSafari()) {
        const overlay = createOverlayModel("iosHint", surface);
        installPromoState.activeOverlay = overlay;
        return { type: "show-install-overlay", overlay };
      }

      if (pendingInstallPromptEvent === null) {
        return { type: "none" };
      }

      installPromoState.activeOverlay = createOverlayModel("prompt", surface);
      return runInstallPrompt(surface);
    },

    async confirmOverlay(): Promise<PwaActionResult> {
      const overlay = installPromoState.activeOverlay;
      if (!overlay) {
        return { type: "none" };
      }

      if (overlay.variant === "iosHint") {
        markInstallPromptDismissed();
        syncInstallAvailability();
        emitStateChange();
        return { type: "restore", target: getRestoreTarget(overlay.surface) };
      }

      return runInstallPrompt(overlay.surface);
    },

    dismissOverlay(): PwaActionResult {
      const overlay = installPromoState.activeOverlay;
      if (!overlay) {
        return { type: "none" };
      }

      markInstallPromptDismissed();
      syncInstallAvailability();
      emitStateChange();
      return { type: "restore", target: getRestoreTarget(overlay.surface) };
    },
  };
}

export function subscribeToPwaStateChanges(listener: () => void): () => void {
  window.addEventListener(PWA_STATE_CHANGE_EVENT, listener);
  return () => {
    window.removeEventListener(PWA_STATE_CHANGE_EVENT, listener);
  };
}

export function createPwaOverlayViewModel(model: PwaInstallOverlayModel): PwaOverlayViewModel {
  return {
    layout: model.surface === "postGameOver" && model.variant === "prompt" ? "sheet" : "modal",
    variant: model.variant === "iosHint" ? "ios-hint" : "default",
    title: model.title,
    message: model.message,
    tips: model.tips,
    primaryLabel: model.primaryLabel,
    secondaryLabel: model.secondaryLabel,
  };
}

function isStandaloneMode(): boolean {
  const navigatorWithStandalone = navigator as Navigator & { standalone?: boolean };
  return window.matchMedia("(display-mode: standalone)").matches || navigatorWithStandalone.standalone === true;
}

function isInstallPromptInstalled(): boolean {
  return isStandaloneMode() || window.localStorage.getItem(INSTALL_PROMPT_INSTALLED_KEY) === "true";
}

function getInstallPromptDismissCount(): number {
  const rawValue = window.localStorage.getItem(INSTALL_PROMPT_DISMISS_COUNT_KEY);
  if (!rawValue) {
    return 0;
  }

  const count = Number(rawValue);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

function getInstallPromptDismissedAt(): number | null {
  const rawValue = window.localStorage.getItem(INSTALL_PROMPT_DISMISSED_AT_KEY);
  if (!rawValue) {
    return null;
  }

  const timestamp = Number(rawValue);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function isIphoneSafari(): boolean {
  return IOS_USER_AGENT_PATTERN.test(navigator.userAgent) && /Safari/i.test(navigator.userAgent) && !SAFARI_EXCLUSION_PATTERN.test(navigator.userAgent);
}
