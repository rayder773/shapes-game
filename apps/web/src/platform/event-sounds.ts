import type { GameEventBus, GameEventType } from "../game/game-events.ts";

export type EventSound = string | {
  src: string;
  volume?: number;
  playbackRate?: number;
};

export type EventSoundMap = Partial<Record<GameEventType, EventSound>>;

type AudioContextLike = Pick<AudioContext, "state" | "destination" | "decodeAudioData" | "createBufferSource" | "createGain" | "resume">;

type EventSoundsOptions = {
  createAudioContext?: () => AudioContextLike;
  load?: (src: string) => Promise<ArrayBuffer>;
  unlockTarget?: Pick<Document, "addEventListener" | "removeEventListener">;
};

function normalizeSound(sound: EventSound): Exclude<EventSound, string> {
  return typeof sound === "string" ? { src: sound } : sound;
}

async function loadSound(src: string): Promise<ArrayBuffer> {
  const response = await fetch(src);
  if (!response.ok) throw new Error(`Could not load sound: ${src}`);
  return response.arrayBuffer();
}

/** Preloads and decodes every SFX, then creates only lightweight source nodes while playing. */
export function installEventSounds(
  events: GameEventBus,
  sounds: EventSoundMap,
  options: EventSoundsOptions = {},
): () => void {
  const AudioContextConstructor = globalThis.AudioContext;
  if (!options.createAudioContext && !AudioContextConstructor) return () => {};

  const createAudioContext = options.createAudioContext ?? (() => new AudioContextConstructor());
  const context = createAudioContext();
  const load = options.load ?? loadSound;
  const unlockTarget = options.unlockTarget ?? document;
  const buffers = new Map<string, Promise<AudioBuffer | null>>();

  for (const configuredSound of Object.values(sounds)) {
    if (!configuredSound) continue;
    const { src } = normalizeSound(configuredSound);
    if (buffers.has(src)) continue;
    buffers.set(src, load(src)
      .then((data) => context.decodeAudioData(data))
      .catch(() => null));
  }

  const unlock = (): void => {
    if (context.state === "suspended") void context.resume().catch(() => {});
  };
  const unlockEvents = ["pointerdown", "touchstart", "keydown"] as const;
  for (const type of unlockEvents) unlockTarget.addEventListener(type, unlock, { passive: true });

  const unsubscribe = events.subscribe(({ type }) => {
    const configuredSound = sounds[type];
    if (!configuredSound) return;

    const sound = normalizeSound(configuredSound);
    const buffer = buffers.get(sound.src);
    if (!buffer) return;

    void buffer.then((decodedBuffer) => {
      if (!decodedBuffer) return;
      unlock();
      const source = context.createBufferSource();
      const gain = context.createGain();
      source.buffer = decodedBuffer;
      source.playbackRate.value = sound.playbackRate ?? 1;
      gain.gain.value = sound.volume ?? 1;
      source.connect(gain);
      gain.connect(context.destination);
      source.start();
    });
  });

  return () => {
    unsubscribe();
    for (const type of unlockEvents) unlockTarget.removeEventListener(type, unlock);
  };
}
