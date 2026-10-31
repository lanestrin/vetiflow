import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { ClinicalDraftProvider, ClinicalDraftRouteBlocker } from "./components/forms/ClinicalDraftProvider";
import App from "./app/App";
import "./styles/globals.scss";

const router = createBrowserRouter([{ path: "*", element:
  <ClinicalDraftProvider><ClinicalDraftRouteBlocker /><App /></ClinicalDraftProvider>
}]);

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
);
