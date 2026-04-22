import "./style.css";
import { pixi } from "./pixi-dsl";
import { GameLoop } from "./game/GameLoop";
import { PlanckBallExample } from "./examples/PlanckBallExample";

const parent = document.querySelector<HTMLDivElement>("#app");

if (parent === null) {
  throw new Error("Missing #app root element.");
}

const example = new PlanckBallExample();
await pixi(example.view())
  .init({
    antialias: true,
    backgroundColor: 0x10151f,
    height: 540,
    parent,
    width: 960,
  });

const loop = new GameLoop((deltaSeconds) => {
  example.step(deltaSeconds);
});

loop.start();
