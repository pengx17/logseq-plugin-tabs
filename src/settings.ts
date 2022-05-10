import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";

export const keyBindings = {
  "tabs:toggle-pin": {
    label: "Toggle Tab Pin Status",
    binding: "mod+p",
  },
  "tabs:close": {
    label: "Close Tab",
    binding: "mod+shift+w",
  },
  "tabs:select-next": {
    label: "Select Next Tab",
    binding: "ctrl+tab",
  },
  "tabs:select-prev": {
    label: "Select Previous Tab",
    binding: "ctrl+shift+tab",
  },
};

export const settings: SettingSchemaDesc[] = Object.entries(keyBindings).map(
  ([key, value]) => ({
    key,
    title: value.label,
    type: "string",
    default: value.binding,
    description: "Keybinding: " + value.label + ". Default: `" + value.binding + "`. You need to restart the app for the changes to take effect.",
  })
);