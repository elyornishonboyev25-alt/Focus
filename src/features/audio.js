import { BROWN_NOISE_VIDEO } from "../core/config.js";
import { runtime } from "../core/runtime.js";

export function brownNoiseLive() {
  return !!(
    runtime.focusTimer &&
    runtime.focusTimer.running &&
    runtime.focusTimer.mode === "work" &&
    runtime.state.pom.brownNoise
  );
}

export function createBrownNoise() {
  if (!brownNoiseLive() || runtime.brownNoiseFrame) return;
  runtime.brownNoiseFrame = document.createElement("iframe");
  runtime.brownNoiseFrame.className = "noise-player";
  runtime.brownNoiseFrame.title = "Brown Noise";
  runtime.brownNoiseFrame.allow = "autoplay; encrypted-media";
  runtime.brownNoiseFrame.setAttribute("aria-hidden", "true");
  runtime.brownNoiseFrame.src = `https://www.youtube.com/embed/${BROWN_NOISE_VIDEO}?autoplay=1&controls=0&disablekb=1&fs=0&modestbranding=1&rel=0&loop=1&playlist=${BROWN_NOISE_VIDEO}&enablejsapi=1&playsinline=1`;
  document.body.appendChild(runtime.brownNoiseFrame);
  setTimeout(() => setBrownVolume(runtime.state.pom.brownVolume), 900);
}

export function destroyBrownNoise() {
  if (!runtime.brownNoiseFrame) return;
  try {
    runtime.brownNoiseFrame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func: "stopVideo", args: [] }),
      "*",
    );
  } catch {}
  runtime.brownNoiseFrame.remove();
  runtime.brownNoiseFrame = null;
}

export function brownCommand(func, args = []) {
  if (!runtime.brownNoiseFrame?.contentWindow) return;
  try {
    runtime.brownNoiseFrame.contentWindow.postMessage(
      JSON.stringify({ event: "command", func, args }),
      "*",
    );
  } catch {}
}

export function setBrownVolume(v) {
  runtime.state.pom.brownVolume = Math.max(0, Math.min(100, +v || 0));
  brownCommand("setVolume", [runtime.state.pom.brownVolume]);
}

export function syncBrownNoise() {
  if (brownNoiseLive()) createBrownNoise();
  else destroyBrownNoise();
}
