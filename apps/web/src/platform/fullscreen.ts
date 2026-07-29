type FullscreenDocument = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenElement = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

export type FullscreenController = {
  initialize: (options?: { autoEnter?: boolean }) => void;
  isSupported: () => boolean;
  isActive: () => boolean;
  toggle: () => Promise<boolean>;
};

export function createFullscreenController(
  document: FullscreenDocument,
  root: FullscreenElement,
): FullscreenController {
  let shouldEnterOnNextGesture = false;
  let hasInstalledGestureRetry = false;

  function isSupported(): boolean {
    return Boolean(root.requestFullscreen || root.webkitRequestFullscreen);
  }

  function isActive(): boolean {
    return Boolean(document.fullscreenElement || document.webkitFullscreenElement);
  }

  async function enter(): Promise<boolean> {
    if (isActive()) return true;

    const requestFullscreen = root.requestFullscreen?.bind(root)
      ?? root.webkitRequestFullscreen?.bind(root);
    if (!requestFullscreen) return false;

    try {
      await requestFullscreen();
      shouldEnterOnNextGesture = false;
      return true;
    } catch {
      return false;
    }
  }

  async function exit(): Promise<boolean> {
    const exitFullscreen = document.exitFullscreen?.bind(document)
      ?? document.webkitExitFullscreen?.bind(document);
    if (!exitFullscreen) return false;

    try {
      await exitFullscreen();
      return true;
    } catch {
      return false;
    }
  }

  function installGestureRetry(): void {
    if (hasInstalledGestureRetry) return;
    hasInstalledGestureRetry = true;

    document.addEventListener("pointerdown", () => {
      if (!shouldEnterOnNextGesture || isActive()) return;
      void enter();
    }, { capture: true });
  }

  return {
    initialize({ autoEnter = false } = {}) {
      if (!autoEnter) return;
      shouldEnterOnNextGesture = true;
      installGestureRetry();
      void enter();
    },
    isSupported,
    isActive,
    async toggle() {
      shouldEnterOnNextGesture = false;
      return isActive() ? exit() : enter();
    },
  };
}
