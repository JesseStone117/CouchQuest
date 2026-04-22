import { clamp, length } from "./utils.js";

const DEADZONE = 0.18;
const ACTIVITY_DECAY = 1.8;

export class ControllerManager {
  constructor() {
    this.connectedPads = [];
    this.events = [];
    this.previousStates = new Map();
    this.swapped = false;
  }

  update(dt) {
    const rawPads = this.readRawPads();
    const nextIndices = new Set(rawPads.map((pad) => pad.index));

    for (const existing of this.connectedPads) {
      if (nextIndices.has(existing.index)) {
        continue;
      }

      this.events.push({
        type: "disconnected",
        label: existing.label,
      });
    }

    const nextPads = [];

    for (const rawPad of rawPads) {
      const previousState = this.previousStates.get(rawPad.index);
      const pad = this.buildPadState(rawPad, previousState, dt);
      nextPads.push(pad);
      this.previousStates.set(rawPad.index, pad.snapshot);

      if (previousState) {
        continue;
      }

      this.events.push({
        type: "connected",
        label: pad.label,
      });
    }

    this.connectedPads = nextPads;

    for (const index of [...this.previousStates.keys()]) {
      if (nextIndices.has(index)) {
        continue;
      }

      this.previousStates.delete(index);
    }
  }

  readRawPads() {
    if (!navigator.getGamepads) {
      return [];
    }

    return [...navigator.getGamepads()]
      .filter(Boolean)
      .filter((pad) => pad.connected)
      .sort((left, right) => left.index - right.index);
  }

  buildPadState(rawPad, previousState, dt) {
    const buttons = {
      a: this.readButton(rawPad.buttons[0]),
      b: this.readButton(rawPad.buttons[1]),
      x: this.readButton(rawPad.buttons[2]),
      y: this.readButton(rawPad.buttons[3]),
      lb: this.readButton(rawPad.buttons[4]),
      rb: this.readButton(rawPad.buttons[5]),
      lt: this.readTrigger(rawPad.buttons[6]),
      rt: this.readTrigger(rawPad.buttons[7]),
      back: this.readButton(rawPad.buttons[8]),
      start: this.readButton(rawPad.buttons[9]),
    };

    const axes = {
      leftX: this.applyDeadzone(rawPad.axes[0] ?? 0),
      leftY: this.applyDeadzone(rawPad.axes[1] ?? 0),
      rightX: this.applyDeadzone(rawPad.axes[2] ?? 0),
      rightY: this.applyDeadzone(rawPad.axes[3] ?? 0),
    };

    const previousButtons = previousState?.buttons ?? {};
    const justPressed = {};

    for (const [name, value] of Object.entries(buttons)) {
      justPressed[name] = value && !previousButtons[name];
    }

    const isActive =
      Object.values(buttons).some(Boolean) ||
      length(axes.leftX, axes.leftY) > 0.35 ||
      length(axes.rightX, axes.rightY) > 0.35;

    const lastActivity = previousState?.activity ?? 0;
    const activity = isActive ? 1 : Math.max(0, lastActivity - dt * ACTIVITY_DECAY);

    return {
      index: rawPad.index,
      name: this.friendlyName(rawPad.id),
      label: `Controller ${rawPad.index + 1}`,
      buttons,
      justPressed,
      axes,
      activity,
      snapshot: {
        buttons,
        activity,
      },
    };
  }

  readButton(button) {
    return Boolean(button?.pressed);
  }

  readTrigger(button) {
    return (button?.value ?? 0) > 0.45;
  }

  applyDeadzone(value) {
    const amount = Math.abs(value);

    if (amount < DEADZONE) {
      return 0;
    }

    const scaled = (amount - DEADZONE) / (1 - DEADZONE);
    return clamp(Math.sign(value) * scaled, -1, 1);
  }

  friendlyName(id) {
    if (!id) {
      return "Unknown gamepad";
    }

    const trimmed = id
      .replace(/\(STANDARD GAMEPAD Vendor: .*?\)/i, "")
      .replace(/Vendor: .*$/i, "")
      .trim();

    if (trimmed) {
      return trimmed;
    }

    return "Standard gamepad";
  }

  hasReadyPair() {
    return this.connectedPads.length >= 2;
  }

  swapRoles() {
    if (!this.hasReadyPair()) {
      return;
    }

    this.swapped = !this.swapped;
  }

  getAssignments() {
    const primaryPad = this.connectedPads[0] ?? null;
    const secondaryPad = this.connectedPads[1] ?? null;

    if (!this.swapped) {
      return {
        hero: primaryPad,
        director: secondaryPad,
      };
    }

    return {
      hero: secondaryPad,
      director: primaryPad,
    };
  }

  getRoleInputs() {
    const assignments = this.getAssignments();

    return {
      hero: this.buildNeutralInput(assignments.hero),
      director: this.buildNeutralInput(assignments.director),
    };
  }

  buildNeutralInput(pad) {
    if (!pad) {
      return {
        connected: false,
        buttons: {
          a: false,
          b: false,
          x: false,
          y: false,
          lb: false,
          rb: false,
          lt: false,
          rt: false,
          back: false,
          start: false,
        },
        justPressed: {
          a: false,
          b: false,
          x: false,
          y: false,
          lb: false,
          rb: false,
          lt: false,
          rt: false,
          back: false,
          start: false,
        },
        axes: {
          leftX: 0,
          leftY: 0,
          rightX: 0,
          rightY: 0,
        },
        label: "Waiting for controller",
      };
    }

    return {
      connected: true,
      buttons: pad.buttons,
      justPressed: pad.justPressed,
      axes: pad.axes,
      label: pad.label,
      name: pad.name,
    };
  }

  anyJustPressed(buttonName) {
    return this.connectedPads.some((pad) => pad.justPressed[buttonName]);
  }

  consumeEvents() {
    const events = [...this.events];
    this.events.length = 0;
    return events;
  }
}
