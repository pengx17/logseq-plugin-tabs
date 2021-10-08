import type { BlockEntity } from "@logseq/libs/dist/LSPlugin";
import produce from "immer";
// @ts-expect-error no types
import keyboardjs from "keyboardjs";
// @ts-expect-error no types
import { us } from "keyboardjs/locales/us";
import React from "react";
import { useDeepCompareEffect, useLatest } from "react-use";
import "./PageTabs.css";
import { ITabInfo } from "./types";
import {
  delay,
  getSourcePage,
  isBlock,
  isMac,
  mainContainerScroll,
  useAdaptMainUIStyle,
  useDebounceFn,
  useEventCallback,
  useScrollWidth,
  useStoreTabs,
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
    return a != null && b != null && a.toLowerCase() === b.toLowerCase();
  }
  if (tab?.page || anotherTab?.page) {
    return isEqual(tab?.uuid, anotherTab?.uuid);
  }
  return Boolean(
    isEqual(tab?.originalName, anotherTab?.originalName) ||
      isEqual(tab?.name, anotherTab?.name) ||
      // isEqual(tab?.uuid, anotherTab?.uuid) ||
      // @ts-expect-error
      tab?.alias?.includes(anotherTab?.id)
  );
}

interface TabsProps {
  tabs: ITabInfo[];
  activePage: ITabInfo | null | undefined;
  onClickTab: (tab: ITabInfo) => void;
  onCloseTab: (tab: ITabInfo, force?: boolean) => void;
  onPinTab: (tab: ITabInfo) => void;
  onSwapTab: (tab: ITabInfo, anotherTab: ITabInfo) => void;
}

const Tabs = React.forwardRef<HTMLElement, TabsProps>(
  ({ activePage, onClickTab, tabs, onCloseTab, onPinTab, onSwapTab }, ref) => {
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

    const debouncedSwap = useDebounceFn(onSwapTab, 100);

    return (
      <div
        // @ts-expect-error ???
        ref={ref}
        data-dragging={draggingTab != null}
        className={`flex items-center h-full px-1`}
        style={{ width: "fit-content" }}
      >
        {tabs.map((tab) => {
          const isActive = isTabEqual(tab, activePage);
          const onClose: React.MouseEventHandler = (e) => {
            e.stopPropagation();
            onCloseTab(tab);
          };
          const onDragOver: React.DragEventHandler = (e) => {
            if (draggingTab) {
              // Prevent drag fly back animation
              e.preventDefault();
              e.dataTransfer.dropEffect = "move";
              debouncedSwap(tab, draggingTab);
            }
          };
          const onDragStart: React.DragEventHandler = (e) => {
            e.dataTransfer.effectAllowed = "move";
            setDraggingTab(tab);
          };
          return (
            <div
              onClick={() => onClickTab(tab)}
              onDoubleClick={() => onPinTab(tab)}
              key={tab.uuid}
              data-active={isActive}
              data-pinned={tab.pinned}
              data-dragging={draggingTab === tab}
              draggable={true}
              onDragOver={onDragOver}
              onDragStart={onDragStart}
              className="logseq-tab group"
            >
              <div className="text-xs rounded border mr-1 px-1 inline light:bg-white dark:bg-dark">
                {isBlock(tab) ? "B" : "P"}
              </div>
              <span className="logseq-tab-title">
                {tab.originalName ?? tab.name}{" "}
                {isBlock(tab) &&
                  `/ ${tab.uuid?.substring(tab.uuid.length - 12)}`}
              </span>
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
);

function isPageRef(element: HTMLElement) {
  const el = element as HTMLAnchorElement;
  return (
    el.tagName === "A" &&
    el.hasAttribute("data-ref") &&
    (el.className.includes("page-ref") || el.className.includes("tag"))
  );
}

function getBlockUUID(element: HTMLElement) {
  return (
    element.getAttribute("blockid") ??
    element.querySelector("[blockid]")?.getAttribute("blockid")
  );
}

/**
 * Captures user CTRL Click a page link.
 */
function useCaptureAddPageAction(cb: (e: ITabInfo, open: boolean) => void) {
  React.useEffect(() => {
    const listener = async (e: MouseEvent) => {
      const target = e.composedPath()[0] as HTMLElement;
      // If CtrlKey is pressed, always open a new tab
      const ctrlKey = isMac() ? e.metaKey : e.ctrlKey;

      if (ctrlKey) {
        let newTab: ITabInfo | null = null;
        if (isPageRef(target)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          const p = await getSourcePage(target.getAttribute("data-ref"));
          if (p) {
            newTab = p;
          }
        } else if (getBlockUUID(target)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          const blockId = getBlockUUID(target);
          if (blockId) {
            const block = await logseq.Editor.getBlock(blockId);
            if (block) {
              const page = await logseq.Editor.getPage(block?.page.id);
              if (page) {
                newTab = { ...page, ...block };
              }
            }
          }
        }
        if (newTab) {
          cb(newTab, e.shiftKey);
        }
      }
    };
    top?.document.addEventListener("mousedown", listener, true);
    return () => {
      top?.document.removeEventListener("mousedown", listener, true);
    };
  }, [cb]);
}

/**
 * the active page is the page that is currently being viewed
 */
export function useActivePage(tabs: ITabInfo[]) {
  const [page, setPage] = React.useState<null | ITabInfo>(null);
  const pageRef = React.useRef(page);
  const setActivePage = useEventCallback(async () => {
    const p = await logseq.Editor.getCurrentPage();
    let tab: ITabInfo | null = null;
    if (p) {
      tab = tabs.find((t) => isTabEqual(t, p)) ?? null;
      if (!tab) {
        tab = await logseq.Editor.getPage(
          p.name ?? (p as BlockEntity)?.page.id
        );
        tab = { ...tab, ...p };
      }
      if (tab.scrollTop) {
        mainContainerScroll({ top: tab.scrollTop });
      }
      pageRef.current = tab;
    }
    setPage(tab);
  });
  React.useEffect(() => {
    return logseq.App.onRouteChanged(setActivePage);
  }, [setActivePage]);
  React.useEffect(() => {
    let stopped = false;
    async function poll() {
      await delay(1500);
      if (!pageRef.current && !stopped) {
        await setActivePage();
        await poll();
      }
    }
    poll();
    return () => {
      stopped = true;
    };
  }, [setActivePage]);

  const tab = React.useMemo(() => {
    if (page) {
      return tabs.find((t) => isTabEqual(t, page)) ?? page;
    }
    return page;
  }, [page, tabs]);

  return [tab, setPage] as const;
}

const sortTabs = (tabs: ITabInfo[]) => {
  tabs.sort((a, b) => {
    if (a.pinned && !b.pinned) {
      return -1;
    } else if (!a.pinned && b.pinned) {
      return 1;
    } else {
      return 0;
    }
  });
};

export function PageTabs(): JSX.Element {
  const [tabs, setTabs] = useStoreTabs();
  const [activePage, setActivePage] = useActivePage(tabs);

  const currActivePageRef = React.useRef<ITabInfo | null>();
  const latestTabsRef = useLatest(tabs);

  const onCloseTab = useEventCallback((tab: ITabInfo, force?: boolean) => {
    const idx = tabs.findIndex((t) => isTabEqual(t, tab));

    // Do not close pinned
    if (tabs[idx]?.pinned && !force) {
      return;
    }
    const newTabs = [...tabs];
    newTabs.splice(idx, 1);
    setTabs(newTabs);

    if (newTabs.length === 0) {
      logseq.App.pushState("home");
    } else if (isTabEqual(tab, activePage)) {
      const newTab = newTabs[Math.min(newTabs.length - 1, idx)];
      setActivePage(newTab);
    }
  });

  const onClickTab = useEventCallback(async (t: ITabInfo) => {
    setActivePage(t);
    // remember current page's scroll position
    const idx = tabs.findIndex((ct) =>
      isTabEqual(ct, currActivePageRef.current)
    );
    if (idx !== -1) {
      const scrollTop =
        top?.document.querySelector("#main-container")?.scrollTop;

      setTabs(
        produce(tabs, (draft) => {
          draft[idx].scrollTop = scrollTop;
        })
      );
    }
  });

  const onNewTab = useEventCallback((t: ITabInfo | null, open = false) => {
    if (t) {
      if (tabs.every((_t) => !isTabEqual(t, _t))) {
        setTabs([...tabs, t]);
      } else {
        open = true;
      }
      if (open) {
        onClickTab(t);
      }
    }
  });

  useCaptureAddPageAction(onNewTab);
  useDeepCompareEffect(() => {
    let timer = 0;
    let newTabs = latestTabsRef.current;
    const prevTab = currActivePageRef.current;
    // If a new ActivePage is set, we will need to replace or insert the tab
    if (activePage) {
      if (tabs.every((t) => !isTabEqual(t, activePage))) {
        newTabs = produce(tabs, (draft) => {
          const currentIndex = draft.findIndex((t) => isTabEqual(t, prevTab));
          const currentPinned = draft[currentIndex]?.pinned;
          if (currentIndex === -1 || currentPinned) {
            draft.push(activePage);
          } else {
            draft[currentIndex] = activePage;
          }
        });
      }
      timer = setTimeout(() => {
        logseq.App.pushState("page", {
          name: isBlock(activePage)
            ? activePage.uuid
            : activePage.originalName ?? activePage.name,
        });
      }, 200);
    }
    currActivePageRef.current = activePage;
    setTabs(newTabs);
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activePage ?? {}]);

  const onPinTab = useEventCallback((t) => {
    setTabs(
      produce(tabs, (draft) => {
        const idx = draft.findIndex((ct) => isTabEqual(ct, t));
        draft[idx].pinned = !draft[idx].pinned;
        sortTabs(draft);
      })
    );
  });

  const onSwapTab = (t0: ITabInfo, t1: ITabInfo) => {
    setTabs(
      produce(tabs, (draft) => {
        const i0 = draft.findIndex((t) => isTabEqual(t, t0));
        const i1 = draft.findIndex((t) => isTabEqual(t, t1));
        draft[i0] = t1;
        draft[i1] = t0;
        sortTabs(draft);
      })
    );
  };

  // Handle keyboard shortcuts.
  // FIXME: not working properly
  React.useEffect(() => {
    const topKb = new keyboardjs.Keyboard(top);
    topKb.setLocale("us", us);
    const closeCurrentTab = (e: Event) => {
      e.stopPropagation();
      e.preventDefault();
      if (currActivePageRef.current) {
        onCloseTab(currActivePageRef.current);
      }
    };
    const ctrlW = isMac() ? "command + w" : "ctrl + w";
    topKb.bind(ctrlW, closeCurrentTab);
    return () => {
      topKb.unbind(ctrlW, closeCurrentTab);
    };
  }, [onCloseTab]);

  const ref = React.useRef<HTMLElement>(null);
  const scrollWidth = useScrollWidth(ref);

  useAdaptMainUIStyle(tabs.length > 0, scrollWidth);

  React.useEffect(() => {
    if (activePage && ref) {
      setTimeout(() => {
        ref.current
          ?.querySelector(`[data-active]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activePage, ref]);

  return (
    <Tabs
      ref={ref}
      onClickTab={onClickTab}
      activePage={activePage}
      tabs={tabs}
      onSwapTab={onSwapTab}
      onPinTab={onPinTab}
      onCloseTab={onCloseTab}
    />
  );
}
