import { useEffect } from "react";
import {
  predictedKeyboardInset,
  rememberKeyboardInset,
} from "@/lib/keyboardInset";
import { recordViewportEvent } from "@/lib/viewportDiagnostics";

const KEYBOARD_OPEN_DELTA = 140;
const KEYBOARD_CLOSE_DELTA = 60;
const KEYBOARD_CONFIRM_DELTA = 80;
const KEYBOARD_PREDICTION_TIMEOUT = 850;

function isTextEntry(element: Element | null): boolean {
  if (element instanceof HTMLTextAreaElement) return true;
  if (element instanceof HTMLInputElement) {
    return ![
      "button",
      "checkbox",
      "color",
      "file",
      "radio",
      "range",
      "reset",
      "submit",
    ].includes(element.type);
  }
  return element instanceof HTMLElement && element.isContentEditable;
}

export function useAppHeight(): void {
  useEffect(() => {
    const root = document.documentElement;
    const touchLayout =
      navigator.maxTouchPoints > 0 ||
      window.matchMedia("(hover: none) and (pointer: coarse)").matches;
    let frame = 0;
    let settleTimer = 0;
    let predictionTimer = 0;
    let cacheTimer = 0;
    let focusScrollTimer = 0;
    let suppressKeyboardUntil = 0;
    let baselineHeight = 0;
    let keyboardOpen = false;
    let predictedKeyboard = false;

    const setAppHeight = (height: number) => {
      const nextHeight = `${Math.round(height)}px`;
      if (root.style.getPropertyValue("--app-height") !== nextHeight) {
        root.style.setProperty("--app-height", nextHeight);
      }
    };

    const setKeyboardInset = (height: number) => {
      const nextInset = `${Math.max(0, Math.round(height))}px`;
      if (root.style.getPropertyValue("--keyboard-inset") !== nextInset) {
        root.style.setProperty("--keyboard-inset", nextInset);
      }
    };

    const setKeyboardOpen = (open: boolean) => {
      if (open === keyboardOpen) return;
      keyboardOpen = open;
      if (open) root.dataset.keyboard = "open";
      else delete root.dataset.keyboard;
      recordViewportEvent("keyboard-state", {
        open,
        predictedKeyboard,
        scrollY: window.scrollY,
      });
    };

    const clearPredictionTimer = () => {
      window.clearTimeout(predictionTimer);
      predictionTimer = 0;
    };

    const cancelPrediction = () => {
      clearPredictionTimer();
      predictedKeyboard = false;
    };

    const applyHeight = () => {
      const viewport = window.visualViewport;
      const height = viewport?.height ?? window.innerHeight ?? 0;
      if (height <= 0) return;

      if (!baselineHeight) {
        baselineHeight = Math.max(height, window.innerHeight || height);
      } else if (height > baselineHeight) {
        baselineHeight = height;
      }

      const hiddenHeight = baselineHeight - height;
      const keyboardConfirmed =
        keyboardOpen &&
        hiddenHeight > KEYBOARD_CONFIRM_DELTA &&
        !predictedKeyboard;

      // The predicted layout is intentional until iOS reports the real
      // keyboard height. Do not restore the full height while waiting.
      if (
        predictedKeyboard &&
        hiddenHeight <= KEYBOARD_CONFIRM_DELTA &&
        performance.now() < suppressKeyboardUntil + KEYBOARD_PREDICTION_TIMEOUT
      ) {
        return;
      }

      if (
        predictedKeyboard &&
        hiddenHeight > KEYBOARD_CONFIRM_DELTA
      ) {
        cancelPrediction();
      }

      setAppHeight(height);

      // iOS can still pan the layout viewport when focusing a field, even
      // though the document itself is height-locked. Undo that pan so the
      // composer remains above the keyboard rather than at the top.
      if (window.scrollX !== 0 || window.scrollY !== 0) {
        window.scrollTo(0, 0);
      }

      if (
        !touchLayout ||
        (viewport?.scale ?? 1) !== 1 ||
        performance.now() < suppressKeyboardUntil
      ) {
        return;
      }

      if (!keyboardOpen && hiddenHeight > KEYBOARD_OPEN_DELTA) {
        setKeyboardOpen(true);
      } else if (keyboardOpen && hiddenHeight < KEYBOARD_CLOSE_DELTA) {
        setKeyboardOpen(false);
      }

      if (keyboardOpen) {
        setKeyboardInset(Math.max(0, hiddenHeight));
      } else {
        setKeyboardInset(0);
      }

      if (keyboardConfirmed || (keyboardOpen && hiddenHeight > KEYBOARD_CONFIRM_DELTA)) {
        window.clearTimeout(cacheTimer);
        const width = Math.round(viewport?.width ?? window.innerWidth);
        cacheTimer = window.setTimeout(() => {
          rememberKeyboardInset(width, baselineHeight, baselineHeight - height);
          recordViewportEvent("cache-keyboard-height", {
            width,
            baselineHeight,
            inset: baselineHeight - height,
          });
        }, 300);
      }
    };

    const scheduleHeight = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(applyHeight);
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(applyHeight, 220);
    };

    const handleFocusIn = (event: FocusEvent) => {
      const target = event.target as Element | null;
      if (target && isTextEntry(target) && !target.closest(".composer")) {
        window.clearTimeout(focusScrollTimer);
        focusScrollTimer = window.setTimeout(() => {
          const active = document.activeElement;
          if (active instanceof HTMLElement && isTextEntry(active)) {
            active.scrollIntoView({ block: "center", inline: "nearest" });
          }
        }, 380);
      }

      if (
        !touchLayout ||
        !event.isTrusted ||
        keyboardOpen ||
        predictedKeyboard ||
        !isTextEntry(target) ||
        performance.now() < suppressKeyboardUntil
      ) {
        return;
      }

      const viewport = window.visualViewport;
      const height = Math.round(viewport?.height ?? window.innerHeight ?? 0);
      if (height <= 0) return;
      baselineHeight = Math.max(baselineHeight, height);

      const width = Math.round(viewport?.width ?? window.innerWidth);
      const inset = predictedKeyboardInset(width, height);
      recordViewportEvent("predict-keyboard", { inset, height, width });
      predictedKeyboard = true;
      setKeyboardOpen(true);
      setKeyboardInset(inset);
      setAppHeight(Math.max(240, height - inset));
      window.scrollTo(0, 0);

      clearPredictionTimer();
      predictionTimer = window.setTimeout(() => {
        if (!predictedKeyboard) return;
        recordViewportEvent("cancel-keyboard-prediction", "");
        predictedKeyboard = false;
        setKeyboardOpen(false);
        setKeyboardInset(0);
        applyHeight();
      }, KEYBOARD_PREDICTION_TIMEOUT);
    };

    const handleOrientationChange = () => {
      suppressKeyboardUntil = performance.now() + 400;
      cancelPrediction();
      setKeyboardOpen(false);
      setKeyboardInset(0);
      baselineHeight = 0;
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        baselineHeight = 0;
        suppressKeyboardUntil = 0;
        applyHeight();
      }, 350);
    };

    applyHeight();
    window.addEventListener("resize", scheduleHeight);
    window.addEventListener("orientationchange", handleOrientationChange);
    window.visualViewport?.addEventListener("resize", scheduleHeight);
    document.addEventListener("focusin", handleFocusIn);
    document.addEventListener("focusout", scheduleHeight);

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settleTimer);
      window.clearTimeout(cacheTimer);
      window.clearTimeout(focusScrollTimer);
      cancelPrediction();
      window.removeEventListener("resize", scheduleHeight);
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.visualViewport?.removeEventListener("resize", scheduleHeight);
      document.removeEventListener("focusin", handleFocusIn);
      document.removeEventListener("focusout", scheduleHeight);
      delete root.dataset.keyboard;
    };
  }, []);
}
