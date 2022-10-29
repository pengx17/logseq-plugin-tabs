import { SettingSchemaDesc } from "@logseq/libs/dist/LSPlugin.user";

export const keyBindings = {
  "tabs:toggle-pin": {
    label: "Toggle Tab Pin Status",
    binding: "",
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
  }
};

const keybindingSettings: SettingSchemaDesc[] = Object.entries(keyBindings).map(
  ([key, value]) => ({
    key,
    title: value.label,
    type: "string",
    default: value.binding,
    description:
      "Keybinding: " +
      value.label +
      ". Default: `" +
      value.binding +
      "`. You need to restart the app for the changes to take effect.",
  })
);

export const inheritCustomCSSSetting: SettingSchemaDesc = {
  key: "tabs:inherit-custom-css",
  title: "Advanced: inherit custom.css styles",
  default: false,
  description:
    "When turning this on, this plugin will also applies styles in custom.css. You need to restart the app for the changes to take effect.",
  type: "boolean",
};

export const showSingleTab: SettingSchemaDesc = {
  key: "tabs:show-single-tab",
  title: "Show single tab?",
  description: "When turned on the tab bar will only show if at least two tabs are open.",
  type: "boolean",
  default: true,
}

export const closeButtonLeft: SettingSchemaDesc = {
  key: "tabs:close-button-left",
  title: "Close tab button on left side?",
  description: "When turned on the close button will be on the left side of the tab.",
  type: "boolean",
  default: false,
}

export const hideCloseAllButton: SettingSchemaDesc = {
  key: "tabs:hide-close-all-button",
  title: "Hide 'Close All' button?",
  description: "When turned on 'Close All' button at the end of tabs list will be hidden.",
  type: "boolean",
  default: false,
}

export const settings: SettingSchemaDesc[] = [
  ...keybindingSettings,
  inheritCustomCSSSetting,
  showSingleTab,
  closeButtonLeft,
  hideCloseAllButton
];
