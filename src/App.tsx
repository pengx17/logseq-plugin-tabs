import React from "react";
import type { PageEntity, BlockEntity } from "@logseq/libs/dist/LSPlugin";
import { getSourcePage, useThemeMode } from "./utils";

import "./App.css";

import { version } from "../package.json";

const KEY_ID = "logseq-opening-page-tabs:" + version;

type ITabInfo = PageEntity & {
  pined?: boolean;
};

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

function useOpeningPageTabs() {
  const [tabs, setTabs] = React.useState<ITabInfo[]>(readFromLocalStorage());

  React.useEffect(() => {
    persistToLocalStorage(tabs);
  }, [tabs]);

  React.useEffect(() => {
    return logseq.App.onCurrentGraphChanged(() => setTabs([]));
  }, []);

  return [tabs, setTabs] as const;
}

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

/**
 * the active page is the page that is currently being viewed
 */
function useActivePage() {
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
      t = setTimeout(poll, 100);
    }
    poll();
    return () => {
      clearTimeout(t);
    };
  }, [page]);

  return page;
}

function useAdpatMainUIStyle(tabsWidth: number) {
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
          width: Math.min(width, tabsWidth) + "px",
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
  }, [tabsWidth]);
}

function isTabActive(tab: ITabInfo, activePage: ITabInfo | null) {
  function isEqual(a?: string, b?: string) {
    return a?.toLowerCase() === b?.toLowerCase();
  }
  return Boolean(
    activePage &&
      (isEqual(tab.name, activePage?.originalName) ||
        isEqual(tab.name, activePage.name))
  );
}

function useAddPageTab(cb: (e: ITabInfo) => void) {
  React.useEffect(() => {
    const listener = async (e: MouseEvent) => {
      const target = e.composedPath()[0] as HTMLAnchorElement;
      // If CtrlKey is pressed, always open a new tab
      const ctrlKey =
        navigator.platform.toUpperCase().indexOf("MAC") >= 0
          ? e.metaKey
          : e.ctrlKey;
      if (
        target.tagName === "A" &&
        target.hasAttribute("data-ref") &&
        (target.className.includes("page-ref") ||
          target.className.includes("tag")) &&
        ctrlKey
      ) {
        e.stopPropagation();
        const p = await getSourcePage(target.getAttribute("data-ref")!);
        if (p) {
          cb(p);
        }
      }
    };
    top.document.addEventListener("mousedown", listener, true);
    return () => {
      top.document.removeEventListener("mousedown", listener, true);
    };
  }, [cb]);
}

// TODO: DnD
function OpeningPageTabs({
  activePage,
  tabs,
  onCloseTab,
  onPinTab,
}: {
  tabs: ITabInfo[];
  activePage: ITabInfo | null;
  onCloseTab: (tab: ITabInfo, tabIdx: number) => void;
  onPinTab: (tab: ITabInfo) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(
    ref.current?.scrollWidth || 0
  );
  React.useEffect(() => {
    setScrollWidth(ref.current?.scrollWidth || 0);
    const mo = new MutationObserver(() => {
      setScrollWidth(ref.current?.scrollWidth || 0);
    });
    mo.observe(ref.current!, { childList: true, subtree: true });
    return () => mo.disconnect();
  }, []);

  useAdpatMainUIStyle(scrollWidth);

  React.useEffect(() => {
    if (activePage) {
      setTimeout(() => {
        ref.current
          ?.querySelector(`[data-active]`)
          ?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    }
  }, [activePage]);

  return (
    <div
      ref={ref}
      className={`flex items-center h-full px-1`}
      style={{ width: "fit-content" }}
    >
      {tabs.map((tab, idx) => {
        const isActive = isTabActive(tab, activePage);
        const onClickTab = () =>
          logseq.App.pushState("page", { name: tab.originalName });
        const onClose: React.MouseEventHandler = (e) => {
          e.stopPropagation();
          onCloseTab(tab, idx);
        };
        return (
          <div
            onClick={onClickTab}
            onDoubleClick={() => onPinTab(tab)}
            key={tab.uuid}
            data-active={isActive}
            className="logseq-tab"
          >
            <span className="logseq-tab-title">{tab.originalName}</span>
            {tab.pined ? (
              <span>📌</span>
            ) : (
              <button
                className="close-button"
                onClick={onClose}
              >
                <CloseSVG />
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function App(): JSX.Element {
  const [tabs, setTabs] = useOpeningPageTabs();
  const themeMode = useThemeMode();
  const activePage = useActivePage();

  React.useEffect(() => {
    if (tabs.length > 1 || !activePage) {
      logseq.showMainUI();
    } else {
      logseq.hideMainUI();
    }
  }, [activePage, tabs]);

  const onCloseTab = (tab: ITabInfo, idx: number) => {
    const newTabs = [...tabs];
    newTabs.splice(idx, 1);
    setTabs(newTabs);
    if (tab.uuid === activePage?.uuid) {
      logseq.App.pushState("page", {
        name: tabs.find((t) => t.uuid !== activePage?.uuid)?.name,
      });
    }
  };

  const onNewTab = React.useCallback(
    (t: ITabInfo | null) => {
      setTabs((_tabs) => {
        if (t && _tabs.every((_t) => _t.uuid !== t.uuid)) {
          return [..._tabs, t];
        }
        return _tabs;
      });
    },
    [setTabs]
  );

  useAddPageTab(onNewTab);

  React.useEffect(() => {
    if (activePage) {
      setTabs((tabs) => {
        if (tabs.every((t) => t.uuid !== activePage?.uuid)) {
          let replaceIndex = tabs.findIndex(
            (t) => t.uuid === activePage.uuid && !t.pined
          );
          if (replaceIndex === -1) {
            replaceIndex = tabs.findIndex((t) => !t.pined);
          }

          if (replaceIndex === -1) {
            return [...tabs, activePage];
          } else {
            const newTabs = [...tabs];
            newTabs.splice(replaceIndex, 1, activePage);
            return newTabs;
          }
        }
        return tabs;
      });
    }
  }, [activePage, setTabs]);

  return (
    <main
      style={{ width: "100vw", height: "100vh" }}
      className={`${themeMode}`}
    >
      <OpeningPageTabs
        activePage={activePage}
        tabs={tabs}
        onPinTab={(t) => {
          setTabs(
            tabs.map((ct) =>
              ct.uuid === t.uuid ? { ...t, pined: !t.pined } : ct
            )
          );
        }}
        onCloseTab={onCloseTab}
      />
    </main>
  );
}

export default App;
