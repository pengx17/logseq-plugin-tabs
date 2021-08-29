import React from "react";
import { PageTabs } from "./PageTabs";
import { useThemeMode } from "./utils";

function App(): JSX.Element {
  const themeMode = useThemeMode();
  return (
    <main
      style={{ width: "100vw", height: "100vh" }}
      className={`${themeMode}`}
    >
      <PageTabs />
    </main>
  );
}

export default App;
