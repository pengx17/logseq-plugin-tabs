import "@logseq/libs";
import "virtual:windi.css";

import "./reset.css";

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

import { logseq as PL } from "../package.json";

const magicKey = `__${PL.id}__loaded__`;

function main() {
  const pluginId = logseq.baseInfo.id;
  console.info(`#${pluginId}: MAIN`);
  ReactDOM.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
    document.getElementById("app")
  );

  // @ts-expect-error
  top[magicKey] = true;
  console.info(`#${pluginId}: MAIN DONE`);
}

// @ts-expect-error
if (top[magicKey]) {
  logseq.App.relaunch().then(main).catch(console.error);
} else {
  logseq.ready(main).catch(console.error);
}
