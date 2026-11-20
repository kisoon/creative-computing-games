/* =========================================================================
   main.js — 캔버스 설정, 입력, 게임 루프
   ========================================================================= */
(() => {
  "use strict";

  const EG = window.EG;
  const canvas = document.getElementById("game");
  const ctx = canvas.getContext("2d");
  const game = EG.game;
  let dpr = 1;
  let lastTime = 0;

  const CONTROL_KEYS = new Set([
    "KeyA",
    "KeyD",
    "KeyW",
    "ArrowLeft",
    "ArrowRight",
    "ArrowUp",
  ]);

  function configureCanvas() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetWidth = Math.round(EG.W * dpr);
    const targetHeight = Math.round(EG.H * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = true;
  }

  function resetStage() {
    game.reset();
    lastTime = performance.now();
  }

  function handleKeyDown(event) {
    const isControl = CONTROL_KEYS.has(event.code);
    const isUtility = event.code === "KeyR" || event.code === "KeyM";
    if (!isControl && !isUtility) return;

    event.preventDefault();
    EG.sfx.init();

    if (event.repeat) {
      if (isControl) EG.keys.add(event.code);
      return;
    }

    if (event.code === "KeyR") {
      resetStage();
      return;
    }

    if (event.code === "KeyM") {
      const muted = EG.sfx.toggleMute();
      game.showToast(
        muted ? "소리가 꺼졌습니다" : "소리가 켜졌습니다",
        muted ? "M 키로 다시 켤 수 있습니다" : "M 키로 음소거할 수 있습니다",
        muted ? "rgba(150, 184, 196, 1)" : "#9defff",
        1.5,
      );
      return;
    }

    EG.keys.add(event.code);
    if (event.code === "KeyW") game.players[0].tryJump();
    if (event.code === "ArrowUp") game.players[1].tryJump();
  }

  function handleKeyUp(event) {
    if (CONTROL_KEYS.has(event.code)) {
      event.preventDefault();
      EG.keys.delete(event.code);
    }
  }

  function update(dt) {
    game.update(dt);
  }

  function render() {
    const c = ctx;

    c.save();
    c.clearRect(0, 0, EG.W, EG.H);

    const shake = EG.fx.shake;
    if (shake > 0.1) {
      c.translate(
        (Math.random() - 0.5) * shake,
        (Math.random() - 0.5) * shake * 0.65,
      );
    }

    EG.drawBackground(c, game);
    EG.drawFloor(c, game);
    EG.drawPoolsBack(c, game);
    EG.drawConduits(c, game);
    EG.drawExits(c, game);
    EG.drawGate(c, game);
    EG.drawPlates(c, game);
    EG.drawWorldLabels(c, game);
    EG.drawPlayers(c, game);
    EG.drawPoolsFront(c, game);
    EG.fx.draw(c);
    c.restore();

    EG.drawScreenFlash(c);
    EG.drawVignette(c);
    EG.drawHUD(c, game);
    EG.drawWinOverlay(c, game);
  }

  function frame(now) {
    const dt = Math.min(0.05, Math.max(0, (now - lastTime) / 1000));
    lastTime = now;
    update(dt);
    render();
    window.requestAnimationFrame(frame);
  }

  configureCanvas();
  resetStage();
  window.addEventListener("resize", configureCanvas);
  window.addEventListener("keydown", handleKeyDown, { passive: false });
  window.addEventListener("keyup", handleKeyUp, { passive: false });
  window.addEventListener("blur", () => EG.keys.clear());
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) lastTime = performance.now();
  });

  // 개발/검수용: 브라우저 콘솔에서 상태를 확인할 수 있습니다.
  window.__elementalDuo = {
    game,
    EG,
    reset: resetStage,
    render,
  };

  window.requestAnimationFrame(frame);
})();
