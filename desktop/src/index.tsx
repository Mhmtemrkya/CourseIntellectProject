import React from "react";
import ReactDOM from "react-dom/client";
import "@/index.css";
import App from "@/App";
import "@/styles/card-system.css";
import { ErrorBoundary } from "@/components/system/ErrorBoundary";
import { CardDesignPreview } from '@/components/ui/CardDesignPreview';

// Ad bilerek "container" değil: Tailwind kaynak metni tarar; ünlemli olumsuzlama
// ifadesini important-container sınıfı sanıp gereksiz CSS üretiyordu.
const rootElement = document.getElementById("root");
if (rootElement === null) throw new Error("#root öğesi bulunamadı.");
const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      {process.env.NODE_ENV === 'development' && window.location.pathname === '/__card-preview' ? <CardDesignPreview /> : <App />}
    </ErrorBoundary>
  </React.StrictMode>,
);
