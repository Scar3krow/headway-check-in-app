const isExperimental = window.location.hostname.includes("experimental");

export const API_URL = isExperimental
    ? "https://headway-check-in-app-experimental.onrender.com"
    : "https://headway-check-in-app.onrender.com";