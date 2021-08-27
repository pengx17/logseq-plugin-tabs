import React from "react";
import type { PageEntity, BlockEntity } from "@logseq/libs/dist/LSPlugin";
import { useThemeMode } from "./utils";

interface ITabInfo {
  ref: string;
  title: string;
}

function useAddPageTab(cb: (e: ITabInfo) => void) {
  React.useEffect(() => {
    const listener = (e: MouseEvent) => {
      const target = e.composedPath()[0] as HTMLAnchorElement;
      if (
        target.tagName === "A" &&
        target.hasAttribute("data-ref") &&
        (target.className.includes("page-ref") ||
          target.className.includes("tag")) &&
        e.metaKey
      ) {
        cb({
          ref: target.getAttribute("data-ref")!,
          title: target.textContent!,
        });
      }
    };
    top.document.addEventListener("mousedown", listener, true);
    return () => {
      top.document.removeEventListener("mousedown", listener, true);
    };
  }, [cb]);
}

const KEY_ID = "logseq-opening-page-tabs";

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

  useAddPageTab((tab) => {
    if (tabs.some((ct) => ct.ref === tab.ref)) {
      return;
    }
    setTabs((tabs) => [...tabs, tab]);
  });

  React.useEffect(() => {
    persistToLocalStorage(tabs);
  }, [tabs]);

  return [tabs, setTabs] as const;
}

const CloseSVG = () => (
  <svg height="1em" width="1em" viewBox="0 0 122.878 122.88" fill="currentColor">
    <g>
      <path d="M1.426,8.313c-1.901-1.901-1.901-4.984,0-6.886c1.901-1.902,4.984-1.902,6.886,0l53.127,53.127l53.127-53.127 c1.901-1.902,4.984-1.902,6.887,0c1.901,1.901,1.901,4.985,0,6.886L68.324,61.439l53.128,53.128c1.901,1.901,1.901,4.984,0,6.886 c-1.902,1.902-4.985,1.902-6.887,0L61.438,68.326L8.312,121.453c-1.901,1.902-4.984,1.902-6.886,0 c-1.901-1.901-1.901-4.984,0-6.886l53.127-53.128L1.426,8.313L1.426,8.313z" />
    </g>
  </svg>
);

function useActivePage() {
  const [page, setPage] = React.useState<null | PageEntity | BlockEntity>();
  React.useEffect(() => {
    async function setActivePage() {
      const p = await logseq.Editor.getCurrentPage();
      setPage(p);
    }
    setActivePage();
    return logseq.App.onRouteChanged(setActivePage);
  }, []);
  return page;
}

function useAdpatMainUIStyle(tabsWidth: number) {
  React.useEffect(() => {
    const listener = () => {
      const { bottom: topOffset, width } = top.document
        .querySelector("#left-container .cp__header")!
        .getBoundingClientRect();
      logseq.setMainUIInlineStyle({
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
  return (
    isEqual(p?.name, t.title) ||
    isEqual(p?.name, t.ref) ||
    isEqual(p?.properties?.title, t.title) ||
    p?.properties?.alias?.some(
      (a: string) => isEqual(a, t.title) || isEqual(a, t.ref)
    )
  );
}

function OpeningPageTabs({
  tabs,
  onCloseTab,
}: {
  tabs: ITabInfo[];
  onCloseTab: (tab: ITabInfo) => void;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [scrollWidth, setScrollWidth] = React.useState(
    ref.current?.scrollWidth || 0
  );
  const activePage = useActivePage();

  React.useEffect(() => {
    setScrollWidth(ref.current?.scrollWidth || 0);
    const mo = new MutationObserver(() => {
      setScrollWidth(ref.current?.scrollWidth || 0);
    });
    mo.observe(ref.current!, { childList: true });
    return () => mo.disconnect();
  }, []);

  useAdpatMainUIStyle(scrollWidth);
  const themeMode = useThemeMode();

  return (
    <div
      ref={ref}
      className={`flex items-stretch h-full`}
      style={{ width: "fit-content" }}
    >
      {tabs.map((tab) => (
        <div
          onClick={() => logseq.App.pushState("page", { name: tab.ref })}
          key={tab.ref}
          className={`
          cursor-pointer font-sans
          text-sm h-full flex items-center px-2 hover:opacity-100
          ${themeMode === "light" ? "text-black" : "text-white"}
          ${
            isTabActive(activePage, tab)
              ? `border-b-2 border-blue-500 ${
                  themeMode === "light"
                    ? "bg-white"
                    : "bg-cool-gray-900"
                }`
              : `opacity-60 ${
                  themeMode === "light"
                    ? "bg-cool-gray-300"
                    : "bg-cool-gray-600"
                }`
          }`}
        >
          <span className="overflow-ellipsis max-w-40 min-w-20 overflow-hidden whitespace-nowrap">
            {tab.title}
          </span>
          <button
            className="text-xs p-1 opacity-60 hover:opacity-100 ml-1"
            onClick={(e) => {
              e.stopPropagation();
              onCloseTab(tab);
            }}
          >
            <CloseSVG />
          </button>
        </div>
      ))}
    </div>
  );
}

function App() {
  const [tabs, setTabs] = useOpeningPageTabs();

  React.useEffect(() => {
    if (tabs.length > 0) {
      logseq.showMainUI();
    } else {
      logseq.hideMainUI();
    }
  }, [tabs]);

  return (
    <main style={{ width: "100vw", height: "100vh" }} className="overflow-auto">
      <OpeningPageTabs
        tabs={tabs}
        onCloseTab={(t) => setTabs(tabs.filter((ct) => ct.ref !== t.ref))}
      />
    </main>
  );
}

export default App;
