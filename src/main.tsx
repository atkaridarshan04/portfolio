import React from "react";
import ReactDOM from "react-dom/client";

import "./styles.css";

import Portfolio from "./components/portfolio/Portfolio";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <Portfolio />
  </React.StrictMode>
);
