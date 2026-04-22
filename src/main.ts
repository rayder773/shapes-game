import "./style.css";
import { pixi } from "./pixi-dsl";
import { GameLoop } from "./game/GameLoop";
import { GameScene } from "./game/GameScene";

const parent = document.querySelector<HTMLDivElement>("#app");

if (parent === null) {
  throw new Error("Missing #app root element.");
}

const scene = new GameScene();
await pixi(scene.view())
  .init({
    antialias: true,
    backgroundColor: 0x10151f,
    height: 540,
    parent,
    width: 960,
  });

const loop = new GameLoop((frame) => {
  scene.tick(frame);
});

loop.start();
