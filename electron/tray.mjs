let trayInstance = null;

function showWindow(window) {
  if (!window || window.isDestroyed()) return;
  if (window.isMinimized()) window.restore();
  if (!window.isVisible()) window.show();
  window.focus();
}

export function attachWindowsCloseHandler(window, isShuttingDown) {
  window.on("close", (event) => {
    if (isShuttingDown()) return;
    event.preventDefault();
    window.hide();
  });
}

export function createWindowsTray({ app, Menu, Tray, getWindow, iconPath, platform = process.platform }) {
  if (platform !== "win32") return null;
  if (trayInstance) return trayInstance;

  const open = () => showWindow(getWindow());
  const tray = new Tray(iconPath);
  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Open", click: open },
      { label: "Quit", click: () => app.quit() },
    ]),
  );
  tray.on("click", open);
  tray.on("double-click", open);
  trayInstance = tray;
  return tray;
}

export function destroyWindowsTray() {
  if (!trayInstance) return;
  trayInstance.destroy();
  trayInstance = null;
}
