export type PlayerPublicIdentity = {
  publicColorId: string;
  publicNameId: string;
};

export const publicColorIds = [
  "blue", "green", "purple", "orange", "cyan", "silver", "gold", "crimson", "violet", "teal",
  "amber", "indigo", "mint", "rose", "white", "black", "lime", "pink", "red", "yellow",
  "azure", "jade", "plum", "coral", "pearl", "neon", "ruby", "sapphire", "emerald", "opal",
] as const;

const codenamePrefixes = [
  "nova", "echo", "solar", "lunar", "astro", "cosmic", "neon", "quantum", "ion", "plasma",
  "turbo", "hyper", "pixel", "vector", "flux", "pulse", "prism", "rocket", "aether", "zenith",
] as const;

const codenameNouns = [
  "fox", "wolf", "raven", "comet", "falcon", "lynx", "pulse", "viper", "otter", "nova",
  "mantis", "orion", "kestrel", "beacon", "puma",
] as const;

export const publicNameIds = codenamePrefixes.flatMap((prefix) =>
  codenameNouns.map((noun) => `${prefix}-${noun}`)
);

export function createRandomPublicIdentity(): PlayerPublicIdentity {
  return {
    publicColorId: publicColorIds[randomIndex(publicColorIds.length)]!,
    publicNameId: publicNameIds[randomIndex(publicNameIds.length)]!,
  };
}

export function createIndexedPublicIdentity(index: number): PlayerPublicIdentity {
  const normalizedIndex = Math.max(0, Math.floor(index));

  return {
    publicColorId: publicColorIds[normalizedIndex % publicColorIds.length]!,
    publicNameId: publicNameIds[Math.floor(normalizedIndex / publicColorIds.length) % publicNameIds.length]!,
  };
}

export function isKnownPublicIdentity(identity: PlayerPublicIdentity): boolean {
  return (
    publicColorIds.includes(identity.publicColorId as (typeof publicColorIds)[number]) &&
    publicNameIds.includes(identity.publicNameId)
  );
}

function randomIndex(length: number): number {
  return Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]! / (2 ** 32) * length);
}
