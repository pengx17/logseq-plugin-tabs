import React, { useState } from "react";
import type { PageEntity } from "@logseq/libs/dist/LSPlugin";
import { useMountedState } from "react-use";

export const useAppVisible = () => {
  const [visible, setVisible] = useState(logseq.isMainUIVisible);
  const isMounted = useMountedState();
  React.useEffect(() => {
    const eventName = "ui:visible:changed";
    const handler = async ({ visible }: any) => {
      if (isMounted()) {
        setVisible(visible);
      }
    };
    logseq.on(eventName, handler);
    return () => {
      logseq.off(eventName, handler);
    };
  }, []);
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
  }, []);
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
    let pages = await logseq.DB.datascriptQuery(`
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