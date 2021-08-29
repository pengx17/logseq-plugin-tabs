import type { BlockEntity } from "@logseq/libs/dist/LSPlugin";
import React from "react";
import "./PageTabs.css";
import { ITabInfo } from "./types";
import {
  getSourcePage,
  useAdpatMainUIStyle,
  useOpeningPageTabs
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

const sortTabs = (tabs: ITabInfo[]) => {
  const newTabs = [...tabs]
  newTabs.sort((a, b) => {
    if (a.pined && !b.pined) {
      return -1;
    } else if (!a.pined && b.pined) {
      return 1;
    } else {
      return 0;
    }
  });
  return newTabs
}


function Tabs({
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
            onMouseDown={onClickTab}
            onDoubleClick={() => onPinTab(tab)}
            key={tab.uuid}
            data-active={isActive}
            data-pined={tab.pined}
            className="logseq-tab"
          >
            <span className="logseq-tab-title">{tab.originalName}</span>
            {tab.pined ? (
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
  useAdpatMainUIStyle();

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

  const onPinTab = React.useCallback(
    (t) => {
      setTabs((_tabs) =>
        sortTabs(
          _tabs.map((ct) =>
            ct.uuid === t.uuid ? { ...t, pined: !t.pined } : ct
          )
        )
      );
    },
    [setTabs]
  );

  return (
    <Tabs
      activePage={activePage}
      tabs={tabs}
      onPinTab={onPinTab}
      onCloseTab={onCloseTab}
    />
  );
}
