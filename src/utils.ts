import React, { useState } from "react";
import type { PageEntity } from "@logseq/libs/dist/LSPlugin";
import { useMountedState } from "react-use";

import { version } from "../package.json";
import { ITabInfo } from "./types";

export const useAppVisible = () => {
  const [visible, setVisible] = useState(logseq.isMainUIVisible);
  const isMounted = useMountedState();
  React.useEffect(() => {
    const eventName = "ui:visible:changed";
    const handler = async ({ visible }: { visible: boolean }) => {
      if (isMounted()) {
        setVisible(visible);
      }
    };
    logseq.on(eventName, handler);
    return () => {
      logseq.off(eventName, handler);
    };
  }, [isMounted]);
  return visible;
};

export const useSidebarVisible = () => {
  const [visible, setVisible] = useState(false);
  const isMounted = useMountedState();
  React.useEffect(() => {
    logseq.App.onSidebarVisibleChanged(({ visible }) => {
      if (isMounted()) {
        setVisible(visible);
      }
    });
  }, [isMounted]);
  return visible;
};

export const useThemeMode = () => {
  const isMounted = useMountedState();
  const [mode, setMode] = React.useState<"dark" | "light">("light");
  React.useEffect(() => {
    setMode(
      (top.document
        .querySelector("html")
        ?.getAttribute("data-theme") as typeof mode) ??
      (matchMedia("prefers-color-scheme: dark").matches ? "dark" : "light")
    );
    return logseq.App.onThemeModeChanged((s) => {
      if (isMounted()) {
        setMode(s.mode);
      }
    });
  }, [isMounted]);

  return mode;
};

export async function getSourcePage(pageName: string): Promise<PageEntity | null> {
  const page = await logseq.Editor.getPage(pageName);

  // @ts-expect-error
  if (page && page.alias?.length > 0) {
    const pages = await logseq.DB.datascriptQuery(`
      [:find (pull ?p [*])
      :where
      [?a :block/name "${page?.name}"]
      [?p :block/alias ?a]]
    `);

    // @ts-expect-error
    const source = pages.flat().find((candidate) =>
      candidate.properties?.alias?.some(
        // @ts-expect-error
        (alias) => alias.toLowerCase() === page?.name
      )
    );
    if (source) {
      return await logseq.Editor.getPage(source.name);
    }
  }
  return page;
}

const KEY_ID = "logseq-opening-page-tabs:" + version;

const readFromLocalStorage = () => {
  const str = localStorage.getItem(KEY_ID);
  if (str) {
    try {
      return JSON.parse(str);
    } catch {
      // no ops
    }
  }
  return [];
};

const persistToLocalStorage = (tabs: ITabInfo[]) => {
  localStorage.setItem(KEY_ID, JSON.stringify(tabs));
};

export function useOpeningPageTabs() {
  const [tabs, setTabs] = React.useState<ITabInfo[]>(readFromLocalStorage());

  React.useEffect(() => {
    persistToLocalStorage(tabs);
  }, [tabs]);

  React.useEffect(() => {
    return logseq.App.onCurrentGraphChanged(() => setTabs([]));
  }, []);

  return [tabs, setTabs] as const;
}

export function useAdpatMainUIStyle() {
  React.useEffect(() => {
    const listener = () => {
      const leftHeader = top.document.querySelector(
        "#left-container .cp__header"
      );

      if (leftHeader) {
        const { bottom: topOffset, width } = leftHeader.getBoundingClientRect();
        logseq.setMainUIInlineStyle({
          zIndex: 9,
          top: `${topOffset + 2}px`,
          width: (width - 10) + "px", // 10 is the width of the scrollbar
          transition: "width 0.2s",
        });
      }
    };
    listener();
    const ob = new ResizeObserver(listener);
    ob.observe(top.document.querySelector("#left-container")!);
    return () => {
      ob.disconnect();
    };
  }, []);
}
