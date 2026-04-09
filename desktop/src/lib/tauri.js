// src/lib/tauri.js
// Tauri window control helpers

export async function closeApp() {
  if (typeof window === "undefined") return;

  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (!isTauri()) return;
  } catch {
    return;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().close();
  } catch (error) {
    console.error("Close failed:", error);
    return false;
  }

  return true;
}

export async function setAppFullscreen(value) {
  if (typeof window === "undefined") return false;

  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (!isTauri()) return false;
  } catch {
    return false;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().setFullscreen(value);
    return true;
  } catch (error) {
    console.error("Fullscreen failed:", error);
    return false;
  }
}

export async function openExternalUrl(url) {
  if (typeof window === "undefined" || !url) return false;

  const normalizedUrl = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const { isTauri } = await import("@tauri-apps/api/core");
    if (isTauri()) {
      const { open } = await import("@tauri-apps/plugin-shell");
      await open(normalizedUrl);
      return true;
    }
  } catch (error) {
    console.error("Tauri external open failed:", error);
  }

  try {
    window.open(normalizedUrl, "_blank", "noopener,noreferrer");
    return true;
  } catch (error) {
    console.error("Browser external open failed:", error);
    return false;
  }
}
