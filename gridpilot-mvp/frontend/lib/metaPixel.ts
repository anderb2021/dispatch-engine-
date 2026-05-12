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

export function trackCompleteRegistration(value = 1, currency = "USD") {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return;
  window.fbq("track", "CompleteRegistration", {
    value,
    currency,
  });
}
