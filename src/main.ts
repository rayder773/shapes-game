import "./style.css";
import { pixi } from "./pixi-dsl";
import { PlanckBallExample } from "./examples/PlanckBallExample";

const parent = document.querySelector<HTMLDivElement>("#app");

if (parent === null) {
  throw new Error("Missing #app root element.");
}

const example = new PlanckBallExample();
const mounted = await pixi(example.view())
  .init({
    antialias: true,
    backgroundColor: 0x10151f,
    height: 540,
    parent,
    width: 960,
  });

mounted.app.ticker.add((ticker) => {
  example.step(ticker.deltaMS / 1000);
});
