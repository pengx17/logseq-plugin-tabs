import React from "react";
import { PageTabs } from "./PageTabs";
import { usePreventFocus, useThemeMode } from "./utils";

function App(): JSX.Element {
  const themeMode = useThemeMode();
  usePreventFocus();
  return (
    <main
      style={{
        width: "100vw",
        height: "100vh",
        // @ts-ignore
        WebkitAppRegion: "drag",
      }}
      className={`${themeMode}`}
    >
      <PageTabs />
    </main>
  );
}

export default App;
