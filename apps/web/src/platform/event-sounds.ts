import type { GameEventBus, GameEventType } from "../game/game-events.ts";

export type EventSound = string | {
  src: string;
  volume?: number;
  playbackRate?: number;
};

export type EventSoundMap = Partial<Record<GameEventType, EventSound>>;

type PlayableAudio = {
  preload: string;
  volume: number;
  playbackRate: number;
  play(): Promise<void>;
};

type EventSoundsOptions = {
  createAudio?: (src: string) => PlayableAudio;
};

function normalizeSound(sound: EventSound): Exclude<EventSound, string> {
  return typeof sound === "string" ? { src: sound } : sound;
}

export function installEventSounds(
  events: GameEventBus,
  sounds: EventSoundMap,
  options: EventSoundsOptions = {},
): () => void {
  const createAudio = options.createAudio ?? ((src) => new Audio(src));

  return events.subscribe(({ type }) => {
    const configuredSound = sounds[type];
    if (!configuredSound) return;

    const sound = normalizeSound(configuredSound);
    const audio = createAudio(sound.src);
    audio.preload = "auto";
    audio.volume = sound.volume ?? 1;
    audio.playbackRate = sound.playbackRate ?? 1;
    void audio.play().catch(() => {
      // Browsers may reject playback until the first user gesture.
    });
  });
}
