export class GameLoop {
  private animationFrameId: number | null = null;
  private lastTime = 0;

  constructor(private readonly step: (deltaSeconds: number) => void) {}

  start(): void {
    if (this.animationFrameId !== null) {
      return;
    }

    this.lastTime = performance.now();
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
    this.step(deltaSeconds);
    this.animationFrameId = requestAnimationFrame(this.frame);
  };
}
