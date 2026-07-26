import type { EventSoundMap } from "./event-sounds.ts";

// Add files under `public/sounds` and map semantic game events here.
// Example: "game.target_consumed": `${import.meta.env.BASE_URL}sounds/target-consumed.mp3`
export const EVENT_SOUNDS = {
  "game.target_consumed": `${import.meta.env.BASE_URL}sounds/target_consumed.wav`,
  "game.life_lost": `${import.meta.env.BASE_URL}sounds/life_lost.wav`,
  "game.game_over": `${import.meta.env.BASE_URL}sounds/game_over.wav`,
  "game.coin_collected": `${import.meta.env.BASE_URL}sounds/coin_collected.wav`,
} satisfies EventSoundMap;
