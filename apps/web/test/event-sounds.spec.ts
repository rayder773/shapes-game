import { describe, expect, test, vi } from "vitest";
import { createGameEventBus } from "../src/game/game-events.ts";
import { installEventSounds } from "../src/platform/event-sounds.ts";
import { EVENT_SOUNDS } from "../src/platform/event-sounds.config.ts";

describe("event sounds", () => {
  test("plays the sound configured for an event", async () => {
    const events = createGameEventBus();
    const play = vi.fn(async () => {});
    const audio = { preload: "", volume: 0, playbackRate: 0, play };
    const createAudio = vi.fn(() => audio);

    installEventSounds(events, {
      "game.target_consumed": {
        src: "/sounds/eat.mp3",
        volume: 0.4,
        playbackRate: 1.1,
      },
    }, { createAudio });
    events.publish({ type: "game.target_consumed", payload: {} });

    expect(createAudio).toHaveBeenCalledWith("/sounds/eat.mp3");
    expect(audio).toMatchObject({ preload: "auto", volume: 0.4, playbackRate: 1.1 });
    expect(play).toHaveBeenCalledOnce();
  });

  test("ignores events without a configured sound and rejected autoplay", async () => {
    const events = createGameEventBus();
    const play = vi.fn(async () => Promise.reject(new Error("autoplay blocked")));
    const createAudio = vi.fn((_src: string) => ({ preload: "", volume: 0, playbackRate: 0, play }));

    const unsubscribe = installEventSounds(events, {
      "game.life_lost": "/sounds/hit.mp3",
    }, { createAudio });
    events.publish({ type: "game.coin_collected", payload: {} });
    events.publish({ type: "game.life_lost", payload: {} });
    await Promise.resolve();
    unsubscribe();
    events.publish({ type: "game.life_lost", payload: {} });

    expect(createAudio).toHaveBeenCalledTimes(1);
  });

  test("plays the configured sounds for gameplay outcomes", () => {
    const events = createGameEventBus();
    const play = vi.fn(async () => {});
    const createAudio = vi.fn((_src: string) => ({ preload: "", volume: 0, playbackRate: 0, play }));

    installEventSounds(events, EVENT_SOUNDS, { createAudio });
    events.publish({ type: "game.target_consumed", payload: {} });
    events.publish({ type: "game.life_lost", payload: {} });
    events.publish({ type: "game.game_over", payload: {} });
    events.publish({ type: "game.coin_collected", payload: {} });

    expect(createAudio.mock.calls.map(([src]) => src)).toEqual([
      "/shapes-game/sounds/target_consumed.wav",
      "/shapes-game/sounds/life_lost.wav",
      "/shapes-game/sounds/game_over.wav",
      "/shapes-game/sounds/coin_collected.wav",
    ]);
    expect(play).toHaveBeenCalledTimes(4);
  });
});
