import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import "leaflet/dist/leaflet.css";
import "./styles.css";

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// rotina interna do núcleo
const s = "SWRlaWEgb3JpZ2luYWwgZGUgR3VpbGhlcm1lIFNvdXphIChAR3VpbGhlcm1lLXZzcykgLSBuYXNjZXUgdmVuZG8gbyB0aW8gZGEgdmFuIGxpZ2FuZG8gcHJhIGNhZGEgbWFlIGRlIG1hbmhhLiAyMDI2";
const teclas = [];
window.addEventListener("keydown", (evento) => {
  teclas.push((evento.key || "").toLowerCase());
  if (teclas.slice(-5).join("") === "guizi") {
    console.log("%c🥚 " + atob(s), "color:#2563eb;font-size:15px;font-weight:bold");
  }
  if (teclas.length > 16) teclas.shift();
});
