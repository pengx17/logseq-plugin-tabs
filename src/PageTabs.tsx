import type {
  BlockEntity,
  SimpleCommandKeybinding,
} from "@logseq/libs/dist/LSPlugin";
import produce from "immer";
import React from "react";
import { useDeepCompareEffect, useLatest } from "react-use";
import "./PageTabs.css";
import { keyBindings } from "./settings";
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
  activeTab: ITabInfo | null | undefined;
  onClickTab: (tab: ITabInfo) => void;
  onCloseTab: (tab: ITabInfo, force?: boolean) => void;
  onPinTab: (tab: ITabInfo) => void;
  onSwapTab: (tab: ITabInfo, anotherTab: ITabInfo) => void;
}

const Tabs = React.forwardRef<HTMLElement, TabsProps>(
  ({ activeTab, onClickTab, tabs, onCloseTab, onPinTab, onSwapTab }, ref) => {
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

    const debouncedSwap = useDebounceFn(onSwapTab, 0);

    return (
      <div
        // @ts-expect-error ???
        ref={ref}
        data-dragging={draggingTab != null}
        className={`flex items-center h-full px-1`}
        style={{ width: "fit-content" }}
        // By default middle button click will enter the horizontal scroll mode
        onMouseDown={(e) => {
          if (e.button === 1) e.preventDefault();
        }}
      >
        {tabs.map((tab) => {
          const isActive = isTabEqual(tab, activeTab);
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
          const prefix = tab.properties?.icon
            ? tab.properties?.icon
            : isBlock(tab)
            ? "B"
            : "P";
          return (
            <div
              onClick={() => onClickTab(tab)}
              onAuxClick={onClose}
              onDoubleClick={() => onPinTab(tab)}
              onContextMenu={(e) => {
                e.preventDefault();
                // TODO: show the same context menu like right-clicking the title?
                console.log("Not implemented yet");
              }}
              key={tab.uuid ?? tab.name}
              data-active={isActive}
              data-pinned={tab.pinned}
              data-dragging={draggingTab === tab}
              draggable={true}
              onDragOver={onDragOver}
              onDragStart={onDragStart}
              className="logseq-tab group"
            >
              <div className="text-xs rounded border mr-1 px-1 inline light:bg-white dark:bg-dark">
                {prefix}
              </div>
              <span className="logseq-tab-title">
                {tab.originalName ?? tab.name}{" "}
                {isBlock(tab) && (
                  <span title={tab.content}>
                    <strong className="text-blue-600">•</strong>
                    <span className="mx-1">{tab.content}</span>
                  </span>
                )}
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

function getPageRef(element: HTMLElement) {
  const el = element as HTMLAnchorElement;
  return getBlockContentPageRef(el) ?? getSidebarPageRef(el);
}

function getBlockContentPageRef(element: HTMLElement) {
  const el = element as HTMLAnchorElement;
  if (
    el.tagName === "A" &&
    el.hasAttribute("data-ref") &&
    (el.className.includes("page-ref") || el.className.includes("tag"))
  ) {
    return element.getAttribute("data-ref");
  }
}

function getSidebarPageRef(element: HTMLElement) {
  const el = element as HTMLAnchorElement;
  if (el.tagName === "A" && el.querySelector(".page-icon")) {
    return Array.from(element.childNodes)
      .find((n) => n.nodeName === "#text")
      ?.textContent?.trim();
  }
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
function useCaptureAddTabAction(cb: (e: ITabInfo, open: boolean) => void) {
  React.useEffect(() => {
    const listener = async (e: MouseEvent) => {
      const target = e.composedPath()[0] as HTMLElement;
      // If CtrlKey is pressed, always open a new tab
      const ctrlKey = isMac() ? e.metaKey : e.ctrlKey;

      if (ctrlKey) {
        let newTab: ITabInfo | null = null;
        if (getPageRef(target)) {
          e.stopPropagation();
          e.stopImmediatePropagation();
          const p = await getSourcePage(getPageRef(target));
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
export function useActiveTab(tabs: ITabInfo[]) {
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
      }
      tab = { ...tab, ...p };
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

  return [page, setPage] as const;
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

const useRegisterKeybindings = (
  key: keyof typeof keyBindings,
  cb: () => void
) => {
  const cbRef = useEventCallback(cb);

  React.useEffect(() => {
    const userKeybinding: string = logseq.settings?.[key];
    if (userKeybinding.trim() !== "") {
      const setting = {
        key,
        label: keyBindings[key].label,
        keybinding: {
          binding: logseq.settings?.[key],
          mode: "global",
        } as SimpleCommandKeybinding,
      };
      logseq.App.registerCommandPalette(setting, cbRef);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const useRegisterSelectNthTabKeybindings = (cb: (nth: number) => void) => {
  const cbRef = useEventCallback(cb);

  React.useEffect(() => {
    for (let i = 1; i <= 9; i++) {
      const setting = {
        key: `tabs-select-nth-tab-${i}`,
        label: `Select tab ${i}`,
        keybinding: {
          binding: `mod+${i}`,
          mode: "non-editing",
        } as SimpleCommandKeybinding,
      };
      logseq.App.registerCommandPalette(setting, () => {
        cbRef(i);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

const useRegisterCloseAllButPins = (cb: (b: boolean) => void) => {
  const cbRef = useEventCallback(cb);

  React.useEffect(() => {
    logseq.App.registerCommandPalette(
      {
        key: `tabs-close-all`,
        label: `Close all tabs`,
        // no keybindings yet
      },
      () => {
        cbRef(false);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    logseq.App.registerCommandPalette(
      {
        key: `tabs-close-others`,
        label: `Close other tabs`,
        // no keybindings yet
      },
      () => {
        cbRef(true);
      }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
};

export function PageTabs(): JSX.Element {
  const [tabs, setTabs] = useStoreTabs();
  const [activeTab, setActiveTab] = useActiveTab(tabs);

  const currActiveTabRef = React.useRef<ITabInfo | null>();
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
    } else if (isTabEqual(tab, activeTab)) {
      const newTab = newTabs[Math.min(newTabs.length - 1, idx)];
      setActiveTab(newTab);
    }
  });

  const getCurrentActiveIndex = () => {
    return tabs.findIndex((ct) => isTabEqual(ct, currActiveTabRef.current));
  };

  const onCloseAllTabs = useEventCallback((excludeActive: boolean) => {
    const newTabs = tabs.filter(
      (t) =>
        t.pinned || (excludeActive && isTabEqual(t, currActiveTabRef.current))
    );
    setTabs(newTabs);
    if (!excludeActive) {
      logseq.App.pushState("home");
    }
  });

  const onChangeTab = useEventCallback(async (t: ITabInfo) => {
    setActiveTab(t);
    const idx = getCurrentActiveIndex();
    // remember current page's scroll position
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
      const previous = tabs.find((_t) => isTabEqual(t, _t));
      if (!previous) {
        setTabs([...tabs, t]);
      } else {
        open = true;
      }
      if (open) {
        onChangeTab({ ...t, pinned: previous?.pinned });
      }
    }
  });

  useCaptureAddTabAction(onNewTab);
  useDeepCompareEffect(() => {
    let timer = 0;
    let newTabs = latestTabsRef.current;
    const prevTab = currActiveTabRef.current;
    // If a new ActiveTab is set, we will need to replace or insert the tab
    if (activeTab) {
      newTabs = produce(tabs, (draft) => {
        if (tabs.every((t) => !isTabEqual(t, activeTab))) {
          const currentIndex = draft.findIndex((t) => isTabEqual(t, prevTab));
          const currentPinned = draft[currentIndex]?.pinned;
          if (currentIndex === -1 || currentPinned) {
            draft.push(activeTab);
          } else {
            draft[currentIndex] = activeTab;
          }
        } else {
          // Update the data if it is already in the list (to update icons etc)
          const currentIndex = draft.findIndex((t) => isTabEqual(t, activeTab));
          draft[currentIndex] = activeTab;
        }
      });
      timer = setTimeout(async () => {
        const p = await logseq.Editor.getCurrentPage();
        if (!isTabEqual(activeTab, p)) {
          logseq.App.pushState("page", {
            name: isBlock(activeTab)
              ? activeTab.uuid
              : activeTab.originalName ?? activeTab.name,
          });
        }
      }, 200);
    }
    currActiveTabRef.current = activeTab;
    setTabs(newTabs);
    return () => {
      if (timer) {
        clearTimeout(timer);
      }
    };
  }, [activeTab ?? {}]);

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

  const ref = React.useRef<HTMLElement>(null);
  const scrollWidth = useScrollWidth(ref);

  useAdaptMainUIStyle(tabs.length > 0, scrollWidth);

  React.useEffect(() => {
    if (activeTab && ref) {
      setTimeout(() => {
        ref.current
          ?.querySelector(`[data-active="true"]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activeTab, ref]);

  useRegisterKeybindings("tabs:toggle-pin", () => {
    if (currActiveTabRef.current) {
      onPinTab(currActiveTabRef.current);
    }
  });

  useRegisterKeybindings("tabs:close", () => {
    if (currActiveTabRef.current) {
      onCloseTab(currActiveTabRef.current);
    }
  });

  useRegisterKeybindings("tabs:select-next", () => {
    let idx = getCurrentActiveIndex() ?? -1;
    idx = (idx + 1) % tabs.length;
    onChangeTab(tabs[idx]);
  });

  useRegisterKeybindings("tabs:select-prev", () => {
    let idx = getCurrentActiveIndex() ?? -1;
    idx = (idx - 1 + tabs.length) % tabs.length;
    onChangeTab(tabs[idx]);
  });

  useRegisterSelectNthTabKeybindings((idx) => {
    if (idx > 0 && idx <= tabs.length) {
      onChangeTab(tabs[idx - 1]);
    }
  });

  useRegisterCloseAllButPins(onCloseAllTabs);

  return (
    <Tabs
      ref={ref}
      onClickTab={onChangeTab}
      activeTab={activeTab}
      tabs={tabs}
      onSwapTab={onSwapTab}
      onPinTab={onPinTab}
      onCloseTab={onCloseTab}
    />
  );
}
