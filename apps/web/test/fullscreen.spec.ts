import { describe, expect, test, vi } from "vitest";
import { createFullscreenController } from "../src/platform/fullscreen.ts";

describe("fullscreen controller", () => {
  test("only enters fullscreen after an explicit manual toggle by default", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    const root = { requestFullscreen } as unknown as HTMLElement;
    const controller = createFullscreenController(document, root);

    controller.initialize();
    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(requestFullscreen).not.toHaveBeenCalled();

    await controller.toggle();
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  test("native mode retries automatic entry on the next user gesture", async () => {
    const requestFullscreen = vi.fn()
      .mockRejectedValueOnce(new Error("User activation required"))
      .mockResolvedValue(undefined);
    const root = { requestFullscreen } as unknown as HTMLElement;
    const controller = createFullscreenController(document, root);

    controller.initialize({ autoEnter: true });
    await Promise.resolve();
    expect(requestFullscreen).toHaveBeenCalledOnce();

    document.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    expect(requestFullscreen).toHaveBeenCalledTimes(2);
  });
});
