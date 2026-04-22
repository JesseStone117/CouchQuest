import { CouchQuestGame } from "./game.js";

const game = new CouchQuestGame({
  canvas: document.getElementById("game-canvas"),
  noticeBanner: document.getElementById("notice-banner"),
  menuPanel: document.getElementById("menu-panel"),
  menuSummary: document.getElementById("menu-summary"),
  controllerGrid: document.getElementById("controller-grid"),
  startButton: document.getElementById("start-button"),
  swapButton: document.getElementById("swap-button"),
  rerollButton: document.getElementById("reroll-button"),
});

game.start();
