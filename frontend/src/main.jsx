import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { mostrarFaixaDemo } from "./demo.js";
import "leaflet/dist/leaflet.css";
import "./styles.css";

mostrarFaixaDemo();

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
