import type { BlockEntity } from "@logseq/libs/dist/LSPlugin";
// @ts-expect-error no types
import keyboardjs from "keyboardjs";
// @ts-expect-error no types
import { us } from "keyboardjs/locales/us";
import React from "react";
import { useDeepCompareEffect, useLatest } from "react-use";
import "./PageTabs.css";
import { ITabInfo } from "./types";
import {
  getSourcePage,
  isMac,
  useAdaptMainUIStyle,
  useEventCallback,
  useOpeningPageTabs,
} from "./utils";

const CloseSVG = () => (
  <svg
    height="1em"
    width="1em"
    viewBox="0 0 122.878 122.88"
    fill="currentColor"
  >
    <g>
      <path d="M1.426,8.313c-1.901-1.901-1.901-4.984,0-6.886c1.901-1.902,4.984-1.902,6.886,0l53.127,53.127l53.127-53.127 c1.901-1.902,4.984-1.902,6.887,0c1.901,1.901,1.901,4.985,0,6.886L68.324,61.439l53.128,53.128c1.901,1.901,1.901,4.984,0,6.886 c-1.902,1.902-4.985,1.902-6.887,0L61.438,68.326L8.312,121.453c-1.901,1.902-4.984,1.902-6.886,0 c-1.901-1.901-1.901-4.984,0-6.886l53.127-53.128L1.426,8.313L1.426,8.313z" />
    </g>
  </svg>
);

function isTabEqual(
  tab: ITabInfo | null | undefined,
  anotherTab: ITabInfo | null | undefined
) {
  function isEqual(a?: string, b?: string) {
    return a?.toLowerCase() === b?.toLowerCase();
  }
  return Boolean(
    isEqual(tab?.originalName, anotherTab?.originalName) ||
      isEqual(tab?.name, anotherTab?.name) ||
      isEqual(tab?.uuid, anotherTab?.uuid) ||
      // @ts-expect-error
      tab?.alias?.includes(anotherTab?.id)
  );
}

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

function Tabs({
  activePage,
  tabs,
  onCloseTab,
  onPinTab,
  onSwapTab,
}: {
  tabs: ITabInfo[];
  activePage: ITabInfo | null;
  onCloseTab: (tab: ITabInfo, tabIdx: number) => void;
  onPinTab: (tab: ITabInfo) => void;
  onSwapTab: (tab: ITabInfo, anotherTab: ITabInfo) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (activePage) {
      setTimeout(() => {
        ref.current
          ?.querySelector(`[data-active]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activePage]);

  const [draggingTab, setDraggingTab] = React.useState<ITabInfo>();

  React.useEffect(() => {
    const dragEndListener = () => {
      setDraggingTab(undefined);
    };
    document.addEventListener("dragend", dragEndListener);
    return () => {
      document.removeEventListener("dragend", dragEndListener);
    };
  }, []);

  return (
    <div
      ref={ref}
      className={`flex items-center h-full px-1`}
      style={{ width: "fit-content" }}
    >
      {tabs.map((tab, idx) => {
        const isActive = isTabEqual(tab, activePage);
        const onClickTab = () =>
          logseq.App.pushState("page", { name: tab.originalName });
        const onClose: React.MouseEventHandler = (e) => {
          e.stopPropagation();
          onCloseTab(tab, idx);
        };
        const onDragOver: React.DragEventHandler = (e) => {
          if (draggingTab) {
            // Prevent fly back animation
            e.preventDefault();
            onSwapTab(tab, draggingTab);
          }
        };
        return (
          <div
            onClick={onClickTab}
            onDoubleClick={() => onPinTab(tab)}
            key={tab.uuid}
            data-active={isActive}
            data-pinned={tab.pinned}
            data-dragging={draggingTab === tab}
            draggable={true}
            onDragOver={onDragOver}
            onDragStart={() => setDraggingTab(tab)}
            className="logseq-tab"
          >
            <span className="logseq-tab-title">{tab.originalName}</span>
            {tab.pinned ? (
              <span>📌</span>
            ) : (
              <button className="close-button" onClick={onClose}>
                <CloseSVG />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function isPageLink(element: HTMLElement) {
  const el = element as HTMLAnchorElement;
  return (
    el.tagName === "A" &&
    el.hasAttribute("data-ref") &&
    (el.className.includes("page-ref") || el.className.includes("tag"))
  );
}

/**
 * Captures user CTRL Click a page link.
 */
function useCaptureAddPageAction(cb: (e: ITabInfo) => void) {
  React.useEffect(() => {
    const listener = async (e: MouseEvent) => {
      const target = e.composedPath()[0] as HTMLElement;
      // If CtrlKey is pressed, always open a new tab
      const ctrlKey = isMac() ? e.metaKey : e.ctrlKey;
      if (isPageLink(target) && ctrlKey) {
        e.stopPropagation();
        const p = await getSourcePage(target.getAttribute("data-ref"));
        if (p) {
          cb(p);
          // Preload Page for performance
          await logseq.Editor.getPageBlocksTree(p.uuid);
        }
      }
    };
    top.document.addEventListener("mousedown", listener, true);
    return () => {
      top.document.removeEventListener("mousedown", listener, true);
    };
  }, [cb]);
}

/**
 * the active page is the page that is currently being viewed
 */
export function useActivePage() {
  const [page, setPage] = React.useState<null | ITabInfo>(null);
  const pageRef = React.useRef(page);
  async function setActivePage() {
    const p = await logseq.Editor.getCurrentPage();
    const page = await logseq.Editor.getPage(
      p?.name ?? (p as BlockEntity)?.page.id
    );
    setPage(page);
    pageRef.current = page;
  }
  React.useEffect(() => {
    return logseq.App.onRouteChanged(setActivePage);
  }, []);
  React.useEffect(() => {
    let t: number;
    async function poll() {
      if (!pageRef.current) {
        await setActivePage();
      }
      t = setTimeout(poll, 500);
    }
    poll();
    return () => {
      clearTimeout(t);
    };
  }, [page]);

  return page;
}

export function PageTabs(): JSX.Element {
  const [tabs, setTabs] = useOpeningPageTabs();
  const activePage = useActivePage();
  useAdaptMainUIStyle();

  React.useEffect(() => {
    if (tabs.length > (activePage ? 1 : 0) || tabs.some((t) => t.pinned)) {
      logseq.showMainUI();
    } else {
      logseq.hideMainUI();
    }
  }, [tabs, activePage]);

  const onCloseTab = useEventCallback((tab: ITabInfo, idx?: number) => {
    if (idx == null) {
      idx = tabs.findIndex((t) => isTabEqual(t, tab));
    }
    // Do not close pinned
    if (tabs[idx].pinned) {
      return;
    }
    const newTabs = [...tabs];
    newTabs.splice(idx, 1);
    setTabs(newTabs);
    if (isTabEqual(tab, activePage)) {
      logseq.App.pushState("page", {
        name: newTabs[Math.min(newTabs.length - 1, idx)].originalName,
      });
    }
  });

  const onNewTab = useEventCallback((t: ITabInfo | null) => {
    setTabs((_tabs) => {
      if (t) {
        if (_tabs.every((_t) => !isTabEqual(t, _t))) {
          return [..._tabs, t];
        } else {
          // If it is already in the tab, just make it active
          logseq.App.pushState("page", { name: t.originalName });
        }
      }
      return _tabs;
    });
  });

  useCaptureAddPageAction(onNewTab);

  const currActivePageRef = React.useRef<ITabInfo | null>();
  const latestTabsRef = useLatest(tabs);

  useDeepCompareEffect(() => {
    let newTabs = latestTabsRef.current;
    // If a new ActivePage is set, we will need to replace or insert the tab
    if (activePage) {
      if (tabs.every((t) => !isTabEqual(t, activePage))) {
        newTabs = [...tabs];
        const currentIndex = tabs.findIndex((t) =>
          isTabEqual(t, currActivePageRef.current)
        );
        const currentPinned = tabs[currentIndex]?.pinned;
        if (currentIndex === -1 || currentPinned) {
          newTabs.push(activePage);
        } else {
          newTabs[currentIndex] = activePage;
        }
      }
    }
    currActivePageRef.current = activePage;
    setTabs(newTabs);
  }, [activePage, setTabs]);

  React.useEffect(() => {
    sortTabs(tabs);
  }, [tabs]);

  const onPinTab = useEventCallback((t) => {
    setTabs((_tabs) =>
      _tabs.map((ct) => (isTabEqual(t, ct) ? { ...t, pinned: !t.pinned } : ct))
    );
  });

  const onSwapTab = (t0: ITabInfo, t1: ITabInfo) => {
    setTabs((_tabs) => {
      const newTabs = [..._tabs];
      const i0 = _tabs.findIndex((t) => isTabEqual(t, t0));
      const i1 = _tabs.findIndex((t) => isTabEqual(t, t1));
      newTabs[i0] = t1;
      newTabs[i1] = t0;
      return newTabs;
    });
  };

  // Handle keyboard shortcuts.
  // FIXME: not working properly
  React.useEffect(() => {
    const topKb = new keyboardjs.Keyboard(top);
    const currKb = new keyboardjs.Keyboard(window);
    topKb.setLocale("us", us);
    currKb.setLocale("us", us);
    const closeCurrentTab = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      if (currActivePageRef.current) {
        onCloseTab(currActivePageRef.current);
      }
    };
    const ctrlW = isMac() ? "command + w" : "ctrl + w";
    topKb.bind(ctrlW, closeCurrentTab);
    currKb.bind(ctrlW, closeCurrentTab);
    return () => {
      topKb.unbind(ctrlW, closeCurrentTab);
      currKb.unbind(ctrlW, closeCurrentTab);
    };
  }, [onCloseTab]);

  return (
    <Tabs
      activePage={activePage}
      tabs={tabs}
      onSwapTab={onSwapTab}
      onPinTab={onPinTab}
      onCloseTab={onCloseTab}
    />
  );
}
