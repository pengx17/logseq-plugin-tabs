import "@logseq/libs";
import React from "react";
import * as ReactDOM from "react-dom/client";
import "virtual:windi.css";
import { settings } from "./settings";

import App from "./App";
import "./reset.css";
import { isMac } from "./utils";

function main() {
  const pluginId = logseq.baseInfo.id;
  console.info(`#${pluginId}: MAIN`);
  const mac = isMac();
  logseq.provideStyle(`
  [data-active-keystroke=${mac ? "Meta" : "Control"} i]
    :is(.block-ref,.page-ref,a.tag) {
    cursor: n-resize
  }
  `);

  const root = ReactDOM.createRoot(document.getElementById("app")!);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );

  console.info(`#${pluginId}: MAIN DONE`);
}

logseq.useSettingsSchema(settings).ready(main).catch(console.error);
