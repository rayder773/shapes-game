import { type GameFrame } from "./GameFrame";

export class GameLoop {
  private elapsedSeconds = 0;
  private animationFrameId: number | null = null;
  private lastTime = 0;

  constructor(private readonly step: (frame: GameFrame) => void) {}

  start(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastTime = performance.now();
    this.elapsedSeconds = 0;
    this.animationFrameId = requestAnimationFrame(this.frame);
  }

  stop(): void {
    if (this.animationFrameId === null) {
      return;
    }

    cancelAnimationFrame(this.animationFrameId);
    this.animationFrameId = null;
  }

  private readonly frame = (now: number) => {
    const deltaSeconds = (now - this.lastTime) / 1000;

    this.lastTime = now;
    this.elapsedSeconds += deltaSeconds;
    this.step({
      deltaSeconds,
      elapsedSeconds: this.elapsedSeconds,
    });
    this.animationFrameId = requestAnimationFrame(this.frame);
  };
}
