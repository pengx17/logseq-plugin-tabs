/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useState } from "react";
import type { PageEntity } from "@logseq/libs/dist/LSPlugin";
import { useDeepCompareEffect, useMountedState } from "react-use";

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
      (top!.document
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

export async function getSourcePage(
  pageName?: string | null
): Promise<PageEntity | null> {
  if (!pageName) {
    return null;
  }
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

const sortTabs = (tabs: ITabInfo[]) => {
  const newTabs = [...tabs];
  newTabs.sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    } else if (!a.pinned && b.pinned) {
      return 1;
    } else {
      return 0;
    }
  });
  return newTabs;
};

const persistToLocalStorage = (tabs: ITabInfo[]) => {
  localStorage.setItem(KEY_ID, JSON.stringify(tabs));
};

export function useOpeningPageTabs() {
  const [tabs, setTabs] = React.useState<ITabInfo[]>(readFromLocalStorage());

  useDeepCompareEffect(() => {
    const sorted = sortTabs(tabs);
    setTabs(sorted);
    persistToLocalStorage(sorted);
  }, [tabs]);

  React.useEffect(() => {
    return logseq.App.onCurrentGraphChanged(() => setTabs([]));
  }, []);

  return [tabs, setTabs] as const;
}

export function useAdaptMainUIStyle(show: boolean, tabsWidth?: number | null) {
  React.useEffect(() => {
    logseq.showMainUI(); // always on
    const listener = () => {
      const leftHeader = top!.document.querySelector(
        "#left-container .cp__header"
      );

      if (leftHeader) {
        const { bottom: topOffset, width } = leftHeader.getBoundingClientRect();
        logseq.setMainUIInlineStyle({
          zIndex: 9,
          top: `${topOffset + 2}px`,
          height: show ? "28px" : "0px",
          width: Math.min(tabsWidth ?? 9999, width - 10) + "px", // 10 is the width of the scrollbar
          transition: "width 0.2s, height 0.2s",
        });
      }
    };
    listener();
    const ob = new ResizeObserver(listener);
    ob.observe(top!.document.querySelector("#left-container")!);
    return () => {
      ob.disconnect();
    };
  }, [show, tabsWidth]);
}

export const isMac = () => {
  return navigator.platform.toUpperCase().includes("MAC");
};

export function useEventCallback<T extends (...args: any[]) => any>(fn: T): T {
  const ref: any = React.useRef();

  // we copy a ref to the callback scoped to the current state/props on each render
  React.useLayoutEffect(() => {
    ref.current = fn;
  });

  return React.useCallback(
    (...args: any[]) => ref.current.apply(void 0, args),
    []
  ) as T;
}

export const useScrollWidth = <T extends HTMLElement>(
  ref: React.RefObject<T>
) => {
  const [scrollWidth, setScrollWidth] = React.useState<number>();
  React.useEffect(() => {
    const mo = new MutationObserver(() => {
      // Run multiple times to take animation into account, hacky...
      setScrollWidth(ref.current?.scrollWidth || 0);
      setTimeout(() => {
        setScrollWidth(ref.current?.scrollWidth || 0);
      }, 100);
      setTimeout(() => {
        setScrollWidth(ref.current?.scrollWidth || 0);
      }, 200);
    });
    if (ref.current) {
      setScrollWidth(ref.current.scrollWidth || 0);
      mo.observe(ref.current, {
        childList: true,
        subtree: true,
        attributes: true,
      });
    }
    return () => mo.disconnect();
  }, [ref]);
  return scrollWidth;
};
