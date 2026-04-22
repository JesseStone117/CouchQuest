import { ControllerManager } from "./controllers.js";
import { renderScene, resizeCanvas } from "./renderer.js";
import { createWorld, getWorldSnapshot, hasHeroFallen, updateWorld } from "./world.js";

export class CouchQuestGame {
  constructor(elements) {
    this.canvas = elements.canvas;
    this.ctx = this.canvas.getContext("2d");
    this.noticeBanner = elements.noticeBanner;
    this.menuPanel = elements.menuPanel;
    this.menuSummary = elements.menuSummary;
    this.controllerGrid = elements.controllerGrid;
    this.startButton = elements.startButton;
    this.swapButton = elements.swapButton;
    this.rerollButton = elements.rerollButton;

    this.controllers = new ControllerManager();
    this.phase = "menu";
    this.lastFrameTime = performance.now();
    this.world = createWorld(this.makeSeed());
    this.lastRunSummary = "";
    this.notice = {
      message: "",
      endTime: 0,
    };

    this.bindEvents();
  }

  bindEvents() {
    window.addEventListener("resize", () => {
      resizeCanvas(this.canvas);
    });

    this.startButton.addEventListener("click", () => {
      this.tryStartGame();
    });

    this.swapButton.addEventListener("click", () => {
      this.swapRoles();
    });

    this.rerollButton.addEventListener("click", () => {
      this.rerollPreview();
    });
  }

  start() {
    resizeCanvas(this.canvas);
    requestAnimationFrame((time) => this.frame(time));
  }

  frame(time) {
    const dt = Math.min(0.033, (time - this.lastFrameTime) / 1000 || 0.016);
    this.lastFrameTime = time;

    this.controllers.update(dt);
    const roleInputs = this.controllers.getRoleInputs();
    this.handleControllerEvents();
    this.handleMenuShortcuts();
    this.handleGameplayShortcuts();

    if (this.phase === "playing") {
      updateWorld(this.world, roleInputs, dt, {
        width: this.canvas.clientWidth,
        height: this.canvas.clientHeight,
      });

      if (hasHeroFallen(this.world)) {
        this.finishRun();
      }
    }

    this.refreshMenuUi();
    this.refreshNotice(time);
    renderScene(
      this.ctx,
      this.canvas,
      this.world,
      this.phase,
      roleInputs,
      this.lastRunSummary,
    );

    requestAnimationFrame((nextTime) => this.frame(nextTime));
  }

  handleControllerEvents() {
    const events = this.controllers.consumeEvents();

    for (const event of events) {
      if (event.type === "connected") {
        this.showNotice(`${event.label} detected.`);
        continue;
      }

      if (event.type === "disconnected") {
        this.showNotice(`${event.label} disconnected.`);
      }
    }
  }

  handleMenuShortcuts() {
    if (this.phase !== "menu") {
      return;
    }

    if (this.controllers.anyJustPressed("x")) {
      this.swapRoles();
    }

    if (!this.controllers.anyJustPressed("a")) {
      return;
    }

    this.tryStartGame();
  }

  handleGameplayShortcuts() {
    if (this.phase !== "playing") {
      return;
    }

    if (!this.controllers.anyJustPressed("back")) {
      return;
    }

    this.showNotice("Returned to the main menu.");
    this.phase = "menu";
    this.world = createWorld(this.makeSeed());
  }

  tryStartGame() {
    if (!this.controllers.hasReadyPair()) {
      this.showNotice("Connect two controllers before starting.");
      return;
    }

    this.phase = "playing";
    this.lastRunSummary = "";
    this.world = createWorld(this.makeSeed());
    this.menuPanel.classList.add("hidden");
    this.requestFullscreen();
    this.showNotice("Adventure started.");
  }

  swapRoles() {
    if (!this.controllers.hasReadyPair()) {
      this.showNotice("Need two controllers before roles can swap.");
      return;
    }

    this.controllers.swapRoles();
    this.showNotice("Hero and director controller roles swapped.");
  }

  rerollPreview() {
    if (this.phase !== "menu") {
      return;
    }

    this.world = createWorld(this.makeSeed());
    this.showNotice("Rolled a new map preview.");
  }

  finishRun() {
    const snapshot = getWorldSnapshot(this.world);
    this.lastRunSummary =
      `Last run: ${snapshot.kills} kills, ${snapshot.wavesCleared} cleared waves, ` +
      `${Math.floor(snapshot.elapsed)}s survived.`;

    this.phase = "menu";
    this.world = createWorld(this.makeSeed());
    this.menuPanel.classList.remove("hidden");
    this.showNotice("The hero fell. Press A to roll into a new run.");
  }

  refreshMenuUi() {
    if (this.phase === "playing") {
      this.menuPanel.classList.add("hidden");
      return;
    }

    this.menuPanel.classList.remove("hidden");

    const assignments = this.controllers.getAssignments();
    const ready = this.controllers.hasReadyPair();
    const heroText = assignments.hero
      ? `${assignments.hero.label} is the hero.`
      : "Hero role is waiting for a controller.";
    const directorText = assignments.director
      ? `${assignments.director.label} is the director.`
      : "Director role is waiting for a controller.";

    this.menuSummary.textContent = ready
      ? `${heroText} ${directorText} Press A or use Start Adventure when you are ready. ${this.lastRunSummary}`
      : `Connect two controllers and press any face button on each one. ${this.lastRunSummary}`;

    this.startButton.disabled = !ready;
    this.swapButton.disabled = !ready;
    this.renderControllerCards(assignments);
  }

  renderControllerCards(assignments) {
    const roleByIndex = new Map();

    if (assignments.hero) {
      roleByIndex.set(assignments.hero.index, "hero");
    }

    if (assignments.director) {
      roleByIndex.set(assignments.director.index, "director");
    }

    const cards = [];

    for (let cardIndex = 0; cardIndex < 4; cardIndex += 1) {
      const pad = this.controllers.connectedPads[cardIndex];

      if (!pad) {
        cards.push(`
          <article class="controller-card">
            <h2>Controller ${cardIndex + 1}</h2>
            <p>Waiting for a controller.</p>
            <span class="role-pill waiting">Waiting</span>
          </article>
        `);
        continue;
      }

      const role = roleByIndex.get(pad.index);
      const roleLabel = role === "hero" ? "Hero" : role === "director" ? "Director" : "Standby";
      const roleClass = role ?? "waiting";
      const activeClass = pad.activity > 0 ? "active" : "";

      cards.push(`
        <article class="controller-card ${activeClass}">
          <h2>${pad.label}</h2>
          <p>${pad.name}</p>
          <p>${pad.activity > 0 ? "Input detected" : "Connected and idle"}</p>
          <span class="role-pill ${roleClass}">${roleLabel}</span>
        </article>
      `);
    }

    this.controllerGrid.innerHTML = cards.join("");
  }

  refreshNotice(time) {
    if (time < this.notice.endTime) {
      this.noticeBanner.textContent = this.notice.message;
      this.noticeBanner.classList.remove("hidden");
      return;
    }

    this.noticeBanner.classList.add("hidden");
  }

  showNotice(message) {
    this.notice.message = message;
    this.notice.endTime = performance.now() + 2600;
  }

  makeSeed() {
    return Math.floor(Date.now() + Math.random() * 1000);
  }

  async requestFullscreen() {
    const element = document.documentElement;

    if (!element.requestFullscreen) {
      return;
    }

    if (document.fullscreenElement) {
      return;
    }

    try {
      await element.requestFullscreen();
    } catch {
      // Fullscreen can fail silently in some browsers. The game still works.
    }
  }
}
