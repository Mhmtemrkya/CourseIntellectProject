import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";

const container = document.getElementById("root");
if (!container) throw new Error("#root öğesi bulunamadı.");
const root = ReactDOM.createRoot(container);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
