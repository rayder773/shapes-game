import { describe, expect, test, vi } from "vitest";
import { createGameEventBus } from "../src/game/game-events.ts";
import { installEventSounds } from "../src/platform/event-sounds.ts";
import { EVENT_SOUNDS } from "../src/platform/event-sounds.config.ts";

function createAudioHarness() {
  const start = vi.fn();
  const source = {
    buffer: null,
    playbackRate: { value: 0 },
    connect: vi.fn(),
    start,
  };
  const gain = { gain: { value: 0 }, connect: vi.fn() };
  const decodedBuffer = {} as AudioBuffer;
  const context = {
    state: "running" as AudioContextState,
    destination: {},
    decodeAudioData: vi.fn(async () => decodedBuffer),
    createBufferSource: vi.fn(() => source),
    createGain: vi.fn(() => gain),
    resume: vi.fn(async () => {}),
  };
  return { context, decodedBuffer, gain, source, start };
}

describe("event sounds", () => {
  test("preloads, decodes and plays a configured sound through Web Audio", async () => {
    const events = createGameEventBus();
    const audio = createAudioHarness();
    const data = new ArrayBuffer(4);
    const load = vi.fn(async () => data);

    installEventSounds(events, {
      "game.target_consumed": { src: "/sounds/eat.mp3", volume: 0.4, playbackRate: 1.1 },
    }, { createAudioContext: () => audio.context as never, load });
    await vi.waitFor(() => expect(audio.context.decodeAudioData).toHaveBeenCalledWith(data));
    events.publish({ type: "game.target_consumed", payload: {} });
    await vi.waitFor(() => expect(audio.start).toHaveBeenCalledOnce());

    expect(load).toHaveBeenCalledWith("/sounds/eat.mp3");
    expect(audio.source.buffer).toBe(audio.decodedBuffer);
    expect(audio.source.playbackRate.value).toBe(1.1);
    expect(audio.gain.gain.value).toBe(0.4);
    expect(audio.source.connect).toHaveBeenCalledWith(audio.gain);
  });

  test("ignores missing events and failed loads", async () => {
    const events = createGameEventBus();
    const audio = createAudioHarness();
    const load = vi.fn(async () => Promise.reject(new Error("missing")));
    const unsubscribe = installEventSounds(events, {
      "game.life_lost": "/sounds/hit.mp3",
    }, { createAudioContext: () => audio.context as never, load });

    events.publish({ type: "game.coin_collected", payload: {} });
    events.publish({ type: "game.life_lost", payload: {} });
    await Promise.resolve();
    await Promise.resolve();
    unsubscribe();
    events.publish({ type: "game.life_lost", payload: {} });
    expect(audio.start).not.toHaveBeenCalled();
  });

  test("preloads each outcome and unlocks a suspended context on user input", async () => {
    const events = createGameEventBus();
    const audio = createAudioHarness();
    audio.context.state = "suspended";
    const load = vi.fn(async (_src: string) => new ArrayBuffer(1));
    const unlockTarget = document.createElement("div");

    installEventSounds(events, EVENT_SOUNDS, {
      createAudioContext: () => audio.context as never,
      load,
      unlockTarget,
    });
    unlockTarget.dispatchEvent(new Event("pointerdown"));

    expect(load.mock.calls.map(([src]) => src)).toEqual([
      "/shapes-game/sounds/target_consumed.wav",
      "/shapes-game/sounds/life_lost.wav",
      "/shapes-game/sounds/game_over.wav",
      "/shapes-game/sounds/coin_collected.wav",
    ]);
    expect(audio.context.resume).toHaveBeenCalledOnce();
  });
});
