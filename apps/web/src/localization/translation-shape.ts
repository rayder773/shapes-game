export type TranslationShape<T> = {
  [Key in keyof T]: T[Key] extends (...args: infer Args) => string
    ? (...args: Args) => string
    : T[Key] extends string
      ? string
      : T[Key] extends object
        ? TranslationShape<T[Key]>
        : never;
};
