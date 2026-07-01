import React from "react";
import ReactDOM from "react-dom/client";
import { initPostHog } from "./analytics/posthog";
import "./index.css";
import App from "./App";

initPostHog();

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
