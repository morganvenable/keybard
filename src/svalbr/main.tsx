import React from "react";
import ReactDOM from "react-dom/client";
import SvalbrApp from "./SvalbrApp";
import "../index.css";
import "virtual:paranoid-fonts";
import "./svalbr.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode><SvalbrApp /></React.StrictMode>,
);
