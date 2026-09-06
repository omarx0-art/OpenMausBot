import assert from "node:assert/strict";
import test from "node:test";

import {
  attachWindowsCloseHandler,
  createWindowsTray,
  destroyWindowsTray,
} from "./tray.mjs";

function fakeWindow({ destroyed = false, minimized = false, visible = false } = {}) {
  const listeners = new Map();
  const calls = [];
  return {
    calls,
    isDestroyed: () => destroyed,
    isMinimized: () => minimized,
    isVisible: () => visible,
    on: (event, listener) => listeners.set(event, listener),
    emit: (event, ...args) => listeners.get(event)?.(...args),
    hide: () => calls.push("hide"),
    restore: () => calls.push("restore"),
    show: () => calls.push("show"),
    focus: () => calls.push("focus"),
  };
}

class FakeTray {
  static instances = [];

  constructor(iconPath) {
    this.iconPath = iconPath;
    this.listeners = new Map();
    this.menu = null;
    this.destroyed = false;
    FakeTray.instances.push(this);
  }

  setContextMenu(menu) {
    this.menu = menu;
  }

  on(event, listener) {
    this.listeners.set(event, listener);
  }

  emit(event) {
    this.listeners.get(event)?.();
  }

  destroy() {
    this.destroyed = true;
  }
}

const Menu = {
  buildFromTemplate: (template) => ({ template }),
};

test.afterEach(() => {
  destroyWindowsTray();
  FakeTray.instances.length = 0;
});

test("intercepts a Windows close and hides the window before shutdown", () => {
  const window = fakeWindow({ visible: true });
  const event = { prevented: false, preventDefault() { this.prevented = true; } };

  attachWindowsCloseHandler(window, () => false);
  window.emit("close", event);

  assert.equal(event.prevented, true);
  assert.deepEqual(window.calls, ["hide"]);
});

test("allows an intentional shutdown to close normally", () => {
  const window = fakeWindow({ visible: true });
  const event = { prevented: false, preventDefault() { this.prevented = true; } };

  attachWindowsCloseHandler(window, () => true);
  window.emit("close", event);

  assert.equal(event.prevented, false);
  assert.deepEqual(window.calls, []);
});

test("initializes only one tray instance and reuses the runtime icon", () => {
  const window = fakeWindow({ visible: false });
  const dependencies = {
    app: { quit() {} },
    Menu,
    Tray: FakeTray,
    getWindow: () => window,
    iconPath: "electron/resources/app-icon.png",
    platform: "win32",
  };

  const first = createWindowsTray(dependencies);
  const second = createWindowsTray(dependencies);

  assert.equal(first, second);
  assert.equal(FakeTray.instances.length, 1);
  assert.equal(first.iconPath, dependencies.iconPath);
  assert.deepEqual(first.menu.template.map((item) => item.label), ["Open", "Quit"]);
});

test("Open restores, shows, and focuses the existing window", () => {
  const window = fakeWindow({ minimized: true, visible: false });
  const tray = createWindowsTray({
    app: { quit() {} },
    Menu,
    Tray: FakeTray,
    getWindow: () => window,
    iconPath: "icon.png",
    platform: "win32",
  });

  tray.menu.template[0].click();

  assert.deepEqual(window.calls, ["restore", "show", "focus"]);
});

test("tray click and double-click restore the existing window", () => {
  const window = fakeWindow({ visible: false });
  const tray = createWindowsTray({
    app: { quit() {} },
    Menu,
    Tray: FakeTray,
    getWindow: () => window,
    iconPath: "icon.png",
    platform: "win32",
  });

  tray.emit("click");
  tray.emit("double-click");

  assert.deepEqual(window.calls, ["show", "focus", "show", "focus"]);
});

test("Quit delegates to app.quit", () => {
  const calls = [];
  const tray = createWindowsTray({
    app: { quit: () => calls.push("quit") },
    Menu,
    Tray: FakeTray,
    getWindow: () => fakeWindow(),
    iconPath: "icon.png",
    platform: "win32",
  });

  tray.menu.template[1].click();

  assert.deepEqual(calls, ["quit"]);
});

test("does not initialize custom tray behavior off Windows", () => {
  const result = createWindowsTray({
    app: { quit() {} },
    Menu,
    Tray: FakeTray,
    getWindow: () => fakeWindow(),
    iconPath: "icon.png",
    platform: "linux",
  });

  assert.equal(result, null);
  assert.equal(FakeTray.instances.length, 0);
});
