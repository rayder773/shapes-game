import { Container, Graphics, Sprite, Text } from "pixi.js";
import { type Unsubscribe } from "./reactive";
import { type PixiChild, type PixiDisplay } from "./nodes";

export type MountedPixiTree = {
  readonly displayObject: PixiDisplay;
  destroy(): void;
};

type MountContext = {
  readonly subscriptions: Unsubscribe[];
};

export function mountPixiNode(node: PixiChild): MountedPixiTree {
  const context: MountContext = {
    subscriptions: [],
  };
  const displayObject = createDisplayObject(node);
  const mountedChildren = node.children.map(mountPixiNode);

  if (displayObject instanceof Container) {
    for (const mountedChild of mountedChildren) {
      displayObject.addChild(mountedChild.displayObject);
    }
  }

  for (const applier of node.getAppliers()) {
    applier(displayObject, {
      track(unsubscribe) {
        context.subscriptions.push(unsubscribe);
      },
    });
  }

  return {
    displayObject,
    destroy() {
      for (const unsubscribe of context.subscriptions) {
        unsubscribe();
      }

      for (const mountedChild of mountedChildren) {
        mountedChild.destroy();
      }

      displayObject.destroy({
        children: false,
      });
    },
  };
}

function createDisplayObject(node: PixiChild): PixiDisplay {
  switch (node.kind) {
    case "container":
      return new Container();
    case "graphic":
      return new Graphics();
    case "sprite":
      return new Sprite();
    case "text":
      return new Text({
        text: "",
      });
  }
}
