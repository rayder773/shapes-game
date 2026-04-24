export type Token<T> = symbol & { readonly __tokenType?: T };

export type ComponentToken<T> = Token<T> & { readonly __componentToken?: true };
export type ResourceToken<T> = Token<T> & { readonly __resourceToken?: true };
export type EventToken<T> = Token<T> & { readonly __eventToken?: true };
export type RenderCommandToken<T> = Token<T> & { readonly __renderCommandToken?: true };

const createToken = <T>(description: string): Token<T> => Symbol(description) as Token<T>;

export const createComponentToken = <T>(description: string): ComponentToken<T> =>
  createToken<T>(description) as ComponentToken<T>;

export const createResourceToken = <T>(description: string): ResourceToken<T> =>
  createToken<T>(description) as ResourceToken<T>;

export const createEventToken = <T>(description: string): EventToken<T> =>
  createToken<T>(description) as EventToken<T>;

export const createRenderCommandToken = <T>(description: string): RenderCommandToken<T> =>
  createToken<T>(description) as RenderCommandToken<T>;
