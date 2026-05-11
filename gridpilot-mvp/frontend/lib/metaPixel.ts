"use client";

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

export function trackButtonClick(buttonName: string) {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("trackCustom", "ButtonClick", {
    button_name: buttonName,
  });
}
