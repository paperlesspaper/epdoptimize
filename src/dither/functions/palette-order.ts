const CANONICAL_COLOR_ORDER = [
  "black",
  "white",
  "blue",
  "green",
  "red",
  "orange",
  "yellow",
  "gameboy0",
  "gameboy1",
  "gameboy2",
  "gameboy3",
];

export interface PaletteColorEntry {
  name: string;
  color: string;
  deviceColor: string;
}

export type PaletteRegistry = Record<string, PaletteColorEntry[]>;

const roleRank = (role: string, index: number) => {
  const rank = CANONICAL_COLOR_ORDER.indexOf(role);
  return rank === -1 ? CANONICAL_COLOR_ORDER.length + index : rank;
};

export const normalizePaletteKey = (name: string | undefined) =>
  (name || "default").toLowerCase();

export const getNamedEntries = (registry: PaletteRegistry, name: string) => {
  const key = normalizePaletteKey(name);
  const entries = registry[key] || registry.default || [];
  return entries
    .map((entry, index) => ({ entry, index }))
    .sort(
      (a, b) =>
        roleRank(a.entry.name, a.index) - roleRank(b.entry.name, b.index)
    )
    .map(({ entry }) => entry);
};

export const getNamedColors = (registry: PaletteRegistry, name: string) =>
  getNamedEntries(registry, name).map((entry) => entry.color);

export const getNamedDeviceColors = (
  registry: PaletteRegistry,
  name: string
) => getNamedEntries(registry, name).map((entry) => entry.deviceColor);

export const getNamedRoles = (registry: PaletteRegistry, name: string) =>
  getNamedEntries(registry, name).map((entry) => entry.name);

export const alignReplacementColors = (
  sourceColors: string[],
  sourceRoles: string[],
  replacementColors: string[],
  replacementRoles: string[]
) => {
  const replacementByRole = new Map<string, string>();
  replacementRoles.forEach((role, index) => {
    replacementByRole.set(role, replacementColors[index]);
  });

  return sourceRoles.map(
    (role, index) =>
      replacementByRole.get(role) ?? sourceColors[index] ?? replacementColors[index]
  );
};
