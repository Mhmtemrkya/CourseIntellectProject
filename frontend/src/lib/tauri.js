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
    alert(
      "Close failed: " +
        (error?.message || error) +
        '\nTauri capabilities dosyanizda "core:window:allow-close" izni acik mi kontrol edin.'
    );
  }
}
