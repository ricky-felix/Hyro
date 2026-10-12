import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./index.css";
import { config } from "./config";

if (config.offlineEnabled) {
	import("./offline/registerServiceWorker").then((m) => m.registerServiceWorker());
}

// NOTE: React.StrictMode is intentionally omitted. In development it
// double-mounts every component, which makes framer-motion replay the
// `whileInView` scroll-reveal animations and produces a visible blink
// on the landing page. Removing it keeps the animations but kills the flash.
createRoot(document.getElementById("root")).render(
	<BrowserRouter>
		<App />
	</BrowserRouter>
);
