import "@logseq/libs";
import "virtual:windi.css";

import "./reset.css";

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";
import { isMac } from "./utils";

function main() {
  const pluginId = logseq.baseInfo.id;
  console.info(`#${pluginId}: MAIN`);
  const mac = isMac();
  logseq.provideStyle(`
  [data-active-keystroke=${mac ? "Meta" : "Control"} i]
    :is(.block-ref,.page-ref,a.tag) {
    cursor: n-resize
  }`);
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById("app")
  );

  console.info(`#${pluginId}: MAIN DONE`);
}

logseq.ready(main).catch(console.error);
