import { MODULE_ID } from "./constants.mjs";

const SETTINGS = {
  animation: { scope: "user", type: Boolean, default: true },
  speed: { scope: "user", type: Number, default: 1, range: { min: 0.5, max: 2, step: 0.1 } },
  sound: { scope: "user", type: Boolean, default: true },
  volume: { scope: "user", type: Number, default: 0.5, range: { min: 0, max: 1, step: 0.05 } },
  tocCollapsed: { scope: "user", type: Boolean, default: false },
  isolation: {
    scope: "client",
    type: String,
    default: "scoped",
    choices: {
      scoped: "BOOKBINDER.Settings.isolation.Choices.scoped",
      shadow: "BOOKBINDER.Settings.isolation.Choices.shadow"
    }
  }
};

export function registerSettings() {
  for (const [key, data] of Object.entries(SETTINGS)) {
    game.settings.register(MODULE_ID, key, {
      name: `BOOKBINDER.Settings.${key}.Name`,
      hint: `BOOKBINDER.Settings.${key}.Hint`,
      config: true,
      ...data
    });
  }
}

export const setting = key => game.settings.get(MODULE_ID, key);
