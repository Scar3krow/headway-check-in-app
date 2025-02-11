const hostname = window.location.hostname;
const isLocalhost = hostname === "localhost" || hostname.startsWith("127.0.0.1");
const isExperimental = hostname.includes("experimental");

export const API_URL = isLocalhost
    ? "http://127.0.0.1:5000" 
    : isExperimental
        ? "https://headway-check-in-app-experimental.onrender.com"
        : "https://headway-check-in-app.onrender.com";