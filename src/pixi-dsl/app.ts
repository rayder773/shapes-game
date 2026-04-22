import { Application, type ApplicationOptions } from "pixi.js";
import { mountPixiNode, type MountedPixiTree } from "./reconciler";
import { type PixiChild } from "./nodes";

export type PixiRoot = {
  init(
    options?: Partial<ApplicationOptions> & {
      parent?: HTMLElement;
    },
  ): Promise<MountedPixiApp>;
};

export type MountedPixiApp = {
  readonly app: Application;
  readonly tree: MountedPixiTree;
  destroy(): void;
};

export function pixi(root: PixiChild): PixiRoot {
  return {
    async init(options = {}) {
      const { parent, ...applicationOptions } = options;
      const app = new Application();

      await app.init(applicationOptions);

      const tree = mountPixiNode(root);
      app.stage.addChild(tree.displayObject);

      if (parent !== undefined) {
        parent.appendChild(app.canvas);
      }

      return {
        app,
        tree,
        destroy() {
          tree.destroy();
          app.destroy(true);
        },
      };
    },
  };
}
