import {
  Container,
  Graphics,
  Sprite,
  Text,
  TextStyle,
  Texture,
  type TextStyleOptions,
} from "pixi.js";
import { bindValue, type Unsubscribe, type ValueSource } from "./reactive";

export type PixiDisplay = Container | Graphics | Sprite | Text;

export type PointLike = {
  x: number;
  y: number;
};

type ApplyContext = {
  track(unsubscribe: Unsubscribe): void;
};

type NodeKind = "container" | "graphic" | "sprite" | "text";

type Applier = (
  displayObject: PixiDisplay,
  context: ApplyContext,
) => void;

export type PixiChild = PixiNode;

export class PixiNode {
  readonly children: PixiChild[];
  readonly kind: NodeKind;
  protected readonly appliers: Applier[] = [];

  constructor(
    kind: NodeKind,
    children: PixiChild[] = [],
  ) {
    this.kind = kind;
    this.children = children;
  }

  getAppliers(): Applier[] {
    return this.appliers;
  }

  position(
    x: ValueSource<number>,
    y: ValueSource<number>,
  ): this;
  position(point: ValueSource<PointLike>): this;
  position(
    xOrPoint: ValueSource<number> | ValueSource<PointLike>,
    y?: ValueSource<number>,
  ): this {
    this.appliers.push((displayObject, context) => {
      if (y === undefined) {
        bindValue(xOrPoint as ValueSource<PointLike>, (point) => {
          displayObject.position.set(point.x, point.y);
        }, context.track);

        return;
      }

      bindValue(xOrPoint as ValueSource<number>, (x) => {
        displayObject.position.x = x;
      }, context.track);
      bindValue(y, (value) => {
        displayObject.position.y = value;
      }, context.track);
    });

    return this;
  }

  scale(
    x: ValueSource<number>,
    y?: ValueSource<number>,
  ): this {
    this.appliers.push((displayObject, context) => {
      bindValue(x, (value) => {
        if (y === undefined) {
          displayObject.scale.set(value);
          return;
        }

        displayObject.scale.x = value;
      }, context.track);

      if (y !== undefined) {
        bindValue(y, (value) => {
          displayObject.scale.y = value;
        }, context.track);
      }
    });

    return this;
  }

  rotation(value: ValueSource<number>): this {
    this.appliers.push((displayObject, context) => {
      bindValue(value, (nextValue) => {
        displayObject.rotation = nextValue;
      }, context.track);
    });

    return this;
  }

  alpha(value: ValueSource<number>): this {
    this.appliers.push((displayObject, context) => {
      bindValue(value, (nextValue) => {
        displayObject.alpha = nextValue;
      }, context.track);
    });

    return this;
  }

  visible(value: ValueSource<boolean>): this {
    this.appliers.push((displayObject, context) => {
      bindValue(value, (nextValue) => {
        displayObject.visible = nextValue;
      }, context.track);
    });

    return this;
  }

  zIndex(value: ValueSource<number>): this {
    this.appliers.push((displayObject, context) => {
      bindValue(value, (nextValue) => {
        displayObject.zIndex = nextValue;
      }, context.track);
    });

    return this;
  }
}

export class ContainerNode extends PixiNode {
  constructor(children: PixiChild[] = []) {
    super("container", children);
  }
}

export class TextNode extends PixiNode {
  constructor(content: ValueSource<string> = "") {
    super("text");
    this.content(content);
  }

  content(value: ValueSource<string>): this {
    this.appliers.push((displayObject, context) => {
      const textObject = displayObject as Text;

      bindValue(value, (nextValue) => {
        textObject.text = nextValue;
      }, context.track);
    });

    return this;
  }

  style(value: ValueSource<TextStyleOptions>): this {
    this.appliers.push((displayObject, context) => {
      const textObject = displayObject as Text;

      bindValue(value, (nextValue) => {
        textObject.style = new TextStyle(nextValue);
      }, context.track);
    });

    return this;
  }
}

export class GraphicNode extends PixiNode {
  constructor() {
    super("graphic");
  }

  draw(value: ValueSource<(graphics: Graphics) => void>): this {
    this.appliers.push((displayObject, context) => {
      const graphicsObject = displayObject as Graphics;

      bindValue(value, (drawGraphics) => {
        graphicsObject.clear();
        drawGraphics(graphicsObject);
      }, context.track);
    });

    return this;
  }
}

export class SpriteNode extends PixiNode {
  constructor(texture?: ValueSource<Texture | string>) {
    super("sprite");

    if (texture !== undefined) {
      this.texture(texture);
    }
  }

  texture(value: ValueSource<Texture | string>): this {
    this.appliers.push((displayObject, context) => {
      const spriteObject = displayObject as Sprite;

      bindValue(value, (nextValue) => {
        spriteObject.texture = typeof nextValue === "string"
          ? Texture.from(nextValue)
          : nextValue;
      }, context.track);
    });

    return this;
  }

  anchor(
    x: ValueSource<number>,
    y?: ValueSource<number>,
  ): this {
    this.appliers.push((displayObject, context) => {
      const spriteObject = displayObject as Sprite;

      bindValue(x, (value) => {
        if (y === undefined) {
          spriteObject.anchor.set(value);
          return;
        }

        spriteObject.anchor.x = value;
      }, context.track);

      if (y !== undefined) {
        bindValue(y, (value) => {
          spriteObject.anchor.y = value;
        }, context.track);
      }
    });

    return this;
  }

  size(
    width: ValueSource<number>,
    height: ValueSource<number>,
  ): this {
    this.appliers.push((displayObject, context) => {
      const spriteObject = displayObject as Sprite;

      bindValue(width, (value) => {
        spriteObject.width = value;
      }, context.track);
      bindValue(height, (value) => {
        spriteObject.height = value;
      }, context.track);
    });

    return this;
  }

  tint(value: ValueSource<number>): this {
    this.appliers.push((displayObject, context) => {
      const spriteObject = displayObject as Sprite;

      bindValue(value, (nextValue) => {
        spriteObject.tint = nextValue;
      }, context.track);
    });

    return this;
  }
}

export function container(...children: PixiChild[]): ContainerNode {
  return new ContainerNode(children);
}

export function text(content?: ValueSource<string>): TextNode {
  return new TextNode(content);
}

export function graphic(): GraphicNode {
  return new GraphicNode();
}

export function sprite(texture?: ValueSource<Texture | string>): SpriteNode {
  return new SpriteNode(texture);
}
