import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";

// Ad bilerek "container" değil: Tailwind kaynak metni tarar; ünlemli olumsuzlama
// ifadesini important-container sınıfı sanıp gereksiz CSS üretiyordu.
const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("#root öğesi bulunamadı.");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
