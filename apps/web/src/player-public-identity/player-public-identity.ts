export type PublicColor = {
  id: string;
  label: string;
  accent: string;
};

export type PublicName = {
  id: string;
  label: string;
  category: "creatures" | "space" | "energy" | "arcade";
};

export type PlayerPublicIdentity = {
  publicColorId: string;
  publicNameId: string;
};

export const publicColors = [
  { id: "blue", label: "Blue", accent: "#54a8ff" },
  { id: "green", label: "Green", accent: "#55d68f" },
  { id: "purple", label: "Purple", accent: "#a88cff" },
  { id: "orange", label: "Orange", accent: "#ff9f4a" },
  { id: "cyan", label: "Cyan", accent: "#4dd7ff" },
  { id: "silver", label: "Silver", accent: "#c8d2df" },
  { id: "gold", label: "Gold", accent: "#ffd166" },
  { id: "crimson", label: "Crimson", accent: "#ff5d73" },
  { id: "violet", label: "Violet", accent: "#c77dff" },
  { id: "teal", label: "Teal", accent: "#2dd4bf" },
  { id: "amber", label: "Amber", accent: "#fbbf24" },
  { id: "indigo", label: "Indigo", accent: "#818cf8" },
  { id: "mint", label: "Mint", accent: "#86efac" },
  { id: "rose", label: "Rose", accent: "#fb7185" },
  { id: "white", label: "White", accent: "#f8fafc" },
  { id: "black", label: "Black", accent: "#64748b" },
  { id: "lime", label: "Lime", accent: "#a3e635" },
  { id: "pink", label: "Pink", accent: "#f472b6" },
  { id: "red", label: "Red", accent: "#f87171" },
  { id: "yellow", label: "Yellow", accent: "#fde047" },
  { id: "azure", label: "Azure", accent: "#38bdf8" },
  { id: "jade", label: "Jade", accent: "#34d399" },
  { id: "plum", label: "Plum", accent: "#d946ef" },
  { id: "coral", label: "Coral", accent: "#fb7185" },
  { id: "pearl", label: "Pearl", accent: "#e2e8f0" },
  { id: "neon", label: "Neon", accent: "#b6ff5c" },
  { id: "ruby", label: "Ruby", accent: "#e11d48" },
  { id: "sapphire", label: "Sapphire", accent: "#2563eb" },
  { id: "emerald", label: "Emerald", accent: "#10b981" },
  { id: "opal", label: "Opal", accent: "#99f6e4" },
] as const satisfies readonly PublicColor[];

const creatures = [
  "Fox", "Wolf", "Raven", "Lynx", "Falcon", "Otter", "Puma", "Viper", "Mantis", "Heron",
  "Kestrel", "Panther", "Owl", "Orca", "Cobra", "Hawk", "Jaguar", "Gecko", "Mako", "Sable",
  "Warden", "Ranger", "Nomad", "Drifter", "Scout", "Glider", "Strider", "Runner", "Hunter", "Voyager",
  "Keeper", "Rider", "Seeker", "Sentinel", "Courier", "Pilot", "Diver", "Sparrow", "Swift", "Bison",
  "Badger", "Marten", "Condor", "Ibis", "Phoenix", "Kraken", "Griffin", "Hydra", "Wyvern", "Sphinx",
  "Moth", "Cometwing", "Nightjar", "Snowcat", "Starling", "Firefly", "Glowfin", "Ray", "Drake", "Aquila",
  "Kodiak", "Marlin", "Peregrine", "Kite", "Lancer", "Rook", "Skylark", "Aster", "Nimbus", "Zephyr",
  "Atlas", "Rune", "Vale", "Echo", "Flare", "Nova", "Pulse", "Prism", "Quasar", "Vortex",
] as const;

const space = [
  "Nova", "Comet", "Orion", "Vega", "Lyra", "Cosmos", "Nebula", "Meteor", "Pulsar", "Quasar",
  "Eclipse", "Solstice", "Zenith", "Orbit", "Astra", "Apollo", "Lunar", "Solar", "Stellar", "Galaxy",
  "Andromeda", "Sirius", "Rigel", "Altair", "Arcturus", "Callisto", "Europa", "Titan", "Ceres", "Helios",
  "Aether", "Draco", "Mirage", "Horizon", "Voyage", "Beacon", "Outpost", "Vector", "Vertex", "Relay",
  "Rocket", "Ion", "Astro", "Celeste", "Cosmic", "Gravity", "Parallax", "Singularity", "Eventide", "Aurora",
  "Corona", "Magellan", "Kepler", "Halley", "Zenon", "Nadir", "Apsis", "Perihelion", "Apogee", "Starfall",
  "Moonrise", "Sunspot", "Skyline", "Darkstar", "Brightstar", "Starforge", "Starpath", "Starwind", "Skyward", "Void",
] as const;

const energy = [
  "Pulse", "Spark", "Volt", "Flux", "Blaze", "Ember", "Surge", "Arc", "Ion", "Photon",
  "Laser", "Plasma", "Quantum", "Neutron", "Proton", "Static", "Wave", "Current", "Charge", "Beacon",
  "Signal", "Echo", "Resonance", "Radiant", "Flare", "Flicker", "Glow", "Flash", "Burst", "Ignite",
  "Kindle", "Fusion", "Prism", "Lumen", "Ray", "Glint", "Shimmer", "Glare", "Afterglow", "Sonic",
  "Tempo", "Rhythm", "Amp", "Circuit", "Dynamo", "Engine", "Turbine", "Reactor", "Core", "Magnet",
  "Neon", "Harmonic", "Overdrive", "Reverb", "Phase", "Impulse", "Kinetic", "Vector", "Momentum", "Velocity",
  "Catalyst", "Eon", "Fission", "Spectrum", "Radiance", "Lattice", "Helix", "Matrix", "Orbitron", "Hyper",
] as const;

const arcade = [
  "Pixel", "Vector", "Bit", "Byte", "Cipher", "Glitch", "Matrix", "Sprite", "Quest", "Combo",
  "Turbo", "Hyper", "Ultra", "Mega", "Omega", "Alpha", "Beta", "Delta", "Sigma", "Kappa",
  "Echo", "Phantom", "Mirage", "Shadow", "Ghost", "Drift", "Dash", "Blitz", "Jolt", "Nexus",
  "Vertex", "Grid", "Node", "Portal", "Warp", "Shift", "Phase", "Loop", "Questor", "Runner",
  "Slider", "Switcher", "Tracker", "Vectoria", "Axiom", "Cipheron", "Datastream", "Syntax", "Kernel", "Module",
  "Patch", "Signal", "Arcade", "Replay", "Powerup", "Bonus", "Level", "Checkpoint", "Comboid", "Streak",
  "Rush", "Rift", "Sparkline", "Datapath", "Nimble", "Zenith", "Prime", "Origin", "Catalyst", "Beacon",
] as const;

const codenamePrefixes = [
  "Nova", "Echo", "Solar", "Lunar", "Astro", "Cosmic", "Neon", "Quantum", "Ion", "Plasma",
  "Turbo", "Hyper", "Pixel", "Vector", "Flux", "Pulse", "Prism", "Rocket", "Aether", "Zenith",
] as const;

const codenameNouns = [
  "Fox", "Wolf", "Raven", "Comet", "Falcon", "Lynx", "Pulse", "Viper", "Otter", "Nova",
  "Mantis", "Orion", "Kestrel", "Beacon", "Puma",
] as const;

function toId(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

function createNames(labels: readonly string[], category: PublicName["category"]): PublicName[] {
  return labels.map((label) => ({
    id: toId(label),
    label,
    category,
  }));
}

function createGeneratedCodenames(): PublicName[] {
  return codenamePrefixes.flatMap((prefix) =>
    codenameNouns.map((noun) => ({
      id: toId(`${prefix} ${noun}`),
      label: `${prefix} ${noun}`,
      category: "arcade",
    } satisfies PublicName))
  );
}

function uniqueNames(names: PublicName[]): PublicName[] {
  const usedIds = new Set<string>();

  return names.filter((name) => {
    if (usedIds.has(name.id)) {
      return false;
    }

    usedIds.add(name.id);
    return true;
  });
}

export const publicNames = uniqueNames([
  ...createGeneratedCodenames(),
  ...createNames(creatures, "creatures"),
  ...createNames(space, "space"),
  ...createNames(energy, "energy"),
  ...createNames(arcade, "arcade"),
]);

const colorById: ReadonlyMap<string, PublicColor> = new Map(publicColors.map((color) => [color.id, color]));
const nameById: ReadonlyMap<string, PublicName> = new Map(publicNames.map((name) => [name.id, name]));

export function getPublicColor(id: string): PublicColor | null {
  return colorById.get(id) ?? null;
}

export function getPublicName(id: string): PublicName | null {
  return nameById.get(id) ?? null;
}

export function formatPlayerPublicName(identity: PlayerPublicIdentity): string {
  const color = getPublicColor(identity.publicColorId);
  const name = getPublicName(identity.publicNameId);

  return `${color?.label ?? identity.publicColorId} ${name?.label ?? identity.publicNameId}`;
}

export function getPlayerPublicAccent(publicColorId: string): string {
  return getPublicColor(publicColorId)?.accent ?? "#ffd166";
}
