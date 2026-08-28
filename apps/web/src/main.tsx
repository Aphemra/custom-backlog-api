import "@fontsource-variable/open-sans/wght.css";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./app/App";
import { ProfileProgressionProvider } from "./components/profile/ProfileProgressionProvider";
import { ToastProvider } from "./components/toast/ToastProvider";
import "./styles/global.css";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ToastProvider>
      <ProfileProgressionProvider>
        <App />
      </ProfileProgressionProvider>
    </ToastProvider>
  </StrictMode>,
);
