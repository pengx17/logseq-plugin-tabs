import "@logseq/libs";
import "virtual:windi.css";

import './reset.css';

import React from "react";
import ReactDOM from "react-dom";
import App from "./App";

import { logseq as PL } from "../package.json";

// @ts-expect-error
const css = (t, ...args) => String.raw(t, ...args);
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

  logseq.setMainUIInlineStyle({
    zIndex: 0,
    position: "fixed",
    left: '0',
    height: '36px'
  });

  logseq.provideStyle(css`
    [data-active-keystroke*="Meta"] :is(.page-ref, .tag) {
      cursor: n-resize;
    }
  `);

  // @ts-expect-error
  top[magicKey] = true;
}

// @ts-expect-error
if (top[magicKey]) {
  top.location.reload();
}

logseq.ready(main).catch(console.error);
