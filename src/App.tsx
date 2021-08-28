import React from "react";
import type { PageEntity } from "@logseq/libs/dist/LSPlugin";
import { useThemeMode } from "./utils";

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
    } catch {}
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

function useActivePage() {
  const [page, setPage] = React.useState<null | ITabInfo>(null);
  const pageRef = React.useRef(page);
  async function setActivePage() {
    const p = await logseq.Editor.getCurrentPage();
    if (p) {
      // @ts-expect-error
      const page = await logseq.Editor.getPage(p.name ?? p.page?.id);
      setPage(page);
      pageRef.current = page;
    }
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
      const { bottom: topOffset, width } = top.document
        .querySelector("#left-container .cp__header")!
        .getBoundingClientRect();
      logseq.setMainUIInlineStyle({
        zIndex: 10,
        top: `${topOffset}px`,
        width: Math.min(width, tabsWidth) + "px",
      });
    };
    listener();
    const ob = new ResizeObserver(listener);
    ob.observe(top.document.querySelector("#left-container")!);
    return () => {
      ob.disconnect();
    };
  }, [tabsWidth]);
}

function isTabActive(p: any, t: ITabInfo) {
  function isEqual(a?: string, b?: string) {
    return a?.toLowerCase() === b?.toLowerCase();
  }
  return isEqual(p?.name, t.originalName) || isEqual(p?.name, t.name);
}

function OpeningPageTabs({
  activePage,
  tabs,
  onCloseTab,
}: {
  tabs: ITabInfo[];
  activePage: ITabInfo | null;
  onCloseTab: (tab: ITabInfo) => void;
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
    mo.observe(ref.current!, { childList: true });
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
      className={`flex items-stretch h-full`}
      style={{ width: "fit-content" }}
    >
      {tabs.map((tab) => {
        const isActive = isTabActive(activePage, tab);
        return (
          <div
            onClick={() =>
              logseq.App.pushState("page", { name: tab.originalName })
            }
            key={tab.uuid}
            data-active={isTabActive(activePage, tab)}
            className={`
        cursor-pointer font-sans
        text-sm h-full flex items-center pl-2 pr-1
        light:text-black dark:text-white
        border-l-1 border-l-light-100
        ${
          isActive
            ? `border-b-2 border-b-blue-500 light:bg-white dark:bg-cool-gray-900`
            : `light:bg-cool-gray-200 dark:bg-cool-gray-800`
        }`}
          >
            <span className="overflow-ellipsis max-w-40 min-w-20 overflow-hidden whitespace-nowrap">
              {tab.originalName}
            </span>
            {tabs.length > 1 && (
              <button
                className="text-xs p-1 opacity-60 hover:opacity-100 ml-1"
                onClick={(e) => {
                  e.stopPropagation();
                  onCloseTab(tab);
                }}
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

function App() {
  const [tabs, setTabs] = useOpeningPageTabs();
  const themeMode = useThemeMode();
  const activePage = useActivePage();

  React.useEffect(() => {
    if (tabs.length > 0) {
      logseq.showMainUI();
    } else {
      logseq.hideMainUI();
    }
  }, [tabs]);

  const onCloseTab = (t: ITabInfo) => {
    setTabs(tabs.filter((ct) => ct.uuid !== t.uuid));
    if (t.uuid === activePage?.uuid) {
      logseq.App.pushState("page", {
        name: tabs.find((t) => t.uuid !== activePage.uuid)?.name,
      });
    }
  };

  React.useEffect(() => {
    if (activePage && tabs.every((t) => t.uuid !== activePage?.uuid)) {
      setTabs([...tabs, activePage]);
    }
  }, [activePage]);

  return (
    <main
      style={{ width: "100vw", height: "100vh" }}
      className={`${themeMode}`}
    >
      <OpeningPageTabs
        activePage={activePage}
        tabs={tabs}
        onCloseTab={onCloseTab}
      />
    </main>
  );
}

export default App;
