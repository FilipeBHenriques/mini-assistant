"use strict";
class MovingCircleApp {
  constructor() {
    this.canSwitchLeft = false;
    this.canSwitchRight = false;
    this.canSwitchTop = false;
    this.canSwitchBottom = false;
    this.animationId = 0;
    this.keys = {};
    this.isSwitchingMonitor = false; // Initialize the switching flag
    this.isInBounceRecovery = false; // Initialize the bounce recovery flag
    this.setupHTML();
    this.circle = this.createCircle();
    this.setupEventListeners();
    this.setupBounceBackListener();

    this.startAnimation();
    this.updateDebugInfo();
  }
  setupHTML() {
    document.body.innerHTML = `
      <div id="debug-info">
        <div>Window Size: <span id="window-size">Loading...</span></div>
        <div>Circle Position: <span id="circle-pos">Loading...</span></div>
        <div>Circle Bounds: <span id="circle-bounds">Loading...</span></div>
        <div>Monitor Info: <span id="monitor-info">Loading...</span></span></div>
        <div>Controls: WASD=Move, SPACE=Manual Switch</div>
      </div>
      <div id="circle">😀</div>
    `;
  }
  createCircle() {
    const element = document.getElementById("circle");
    // Start in the center of this window
    const startX = window.innerWidth / 2;
    const startY = window.innerHeight / 2;
    console.log(`Window size: ${window.innerWidth}x${window.innerHeight}`);
    console.log(`Starting position: ${startX}, ${startY}`);
    return {
      x: startX,
      y: startY,
      dx: (Math.random() - 0.5) * 4,
      dy: (Math.random() - 0.5) * 4,
      element,
    };
  }

  setupEventListeners() {
    // Keyboard controls
    document.addEventListener("keydown", (e) => {
      this.keys[e.key.toLowerCase()] = true;

      // Switch monitor with SPACE key (manual override)
      if (e.key === " ") {
        e.preventDefault();
        this.switchMonitor();
      }
    });

    document.addEventListener("keyup", (e) => {
      this.keys[e.key.toLowerCase()] = false;
    });
  }

  switchMonitor() {
    // Send message to main process to switch monitor
    if (window.electronAPI && window.electronAPI.switchMonitor) {
      window.electronAPI.switchMonitor();
    } else {
      console.log("Press SPACE to switch monitors!");
    }
  }

  switchMonitorDirection(direction) {
    // Send message to main process to switch monitor in specific direction
    if (window.electronAPI && window.electronAPI.switchMonitorDirection) {
      window.electronAPI.switchMonitorDirection(direction);
    } else {
      console.log(
        `Trying to switch to ${direction} monitor but API not available`
      );
      // Fallback to regular switch
      this.switchMonitor();
    }
  }

  setupBounceBackListener() {
    // Listen for bounce-back messages from main process
    if (window.electronAPI && window.electronAPI.onBounceBack) {
      window.electronAPI.onBounceBack((direction) => {
        console.log(`No monitor in ${direction} direction - bouncing back`);
        this.bounceBack(direction);
      });
    }
  }

  bounceBack(direction) {
    const bounceFactor = 0.05; // how fast it reverses
    const interval = setInterval(() => {
      if (direction === "left" || direction === "right") {
        this.circle.dx += direction === "left" ? bounceFactor : -bounceFactor;
        if (Math.abs(this.circle.dx) >= 1) clearInterval(interval);
      } else {
        this.circle.dy += direction === "top" ? bounceFactor : -bounceFactor;
        if (Math.abs(this.circle.dy) >= 1) clearInterval(interval);
      }
    }, 16); // ~60fps
  }

  updateDebugInfo() {
    const windowSizeEl = document.getElementById("window-size");
    const circlePosEl = document.getElementById("circle-pos");
    const circleBoundsEl = document.getElementById("circle-bounds");
    const monitorInfoEl = document.getElementById("monitor-info");

    if (windowSizeEl) {
      windowSizeEl.textContent = `${window.innerWidth}x${window.innerHeight}`;
    }
    if (circlePosEl) {
      circlePosEl.textContent = `${Math.round(this.circle.x)}, ${Math.round(
        this.circle.y
      )}`;
    }
    if (circleBoundsEl) {
      const leftBound = 0;
      const rightBound = window.innerWidth - 80;
      const topBound = 0;
      const bottomBound = window.innerHeight - 80;
      circleBoundsEl.textContent = `X: ${leftBound} to ${rightBound}, Y: ${topBound} to ${bottomBound}`;
    }
    if (monitorInfoEl) {
      monitorInfoEl.textContent = `Window at (${window.screenX}, ${window.screenY})`;
    }
  }

  moveCircle() {
    // Manual movement with WASD
    const speed = 2;
    if (this.keys["w"] || this.keys["arrowup"]) {
      this.circle.y -= speed;
    }
    if (this.keys["s"] || this.keys["arrowdown"]) {
      this.circle.y += speed;
    }
    if (this.keys["a"] || this.keys["arrowleft"]) {
      this.circle.x -= speed;
    }
    if (this.keys["d"] || this.keys["arrowright"]) {
      this.circle.x += speed;
    }

    // Automatic movement (only when no keys are pressed)
    if (
      !this.keys["w"] &&
      !this.keys["s"] &&
      !this.keys["a"] &&
      !this.keys["d"] &&
      !this.keys["arrowup"] &&
      !this.keys["arrowdown"] &&
      !this.keys["arrowleft"] &&
      !this.keys["arrowright"]
    ) {
      this.circle.x += this.circle.dx;
      this.circle.y += this.circle.dy;
    }

    // Check if circle hits connecting walls (not all borders)
    let shouldSwitchMonitor = false;
    let switchDirection = null;

    // Soft bounce at window edges
    if (this.circle.x <= 0) {
      this.circle.x = 0;
      this.circle.dx = Math.abs(this.circle.dx) * 0.5;
    } else if (this.circle.x >= window.innerWidth - 80) {
      this.circle.x = window.innerWidth - 80;
      this.circle.dx = -Math.abs(this.circle.dx) * 0.5;
    }

    if (this.circle.y <= 0) {
      this.circle.y = 0;
      this.circle.dy = Math.abs(this.circle.dy) * 0.5;
    } else if (this.circle.y >= window.innerHeight - 80) {
      this.circle.y = window.innerHeight - 80;
      this.circle.dy = -Math.abs(this.circle.dy) * 0.5;
    }

    if (shouldSwitchMonitor) {
      if (this.circle.x <= 0 && this.canSwitchLeft) {
        shouldSwitchMonitor = true;
        switchDirection = "left";
      } else if (
        this.circle.x >= window.innerWidth - 80 &&
        this.canSwitchRight
      ) {
        shouldSwitchMonitor = true;
        switchDirection = "right";
      }

      if (this.circle.y <= 0 && this.canSwitchTop) {
        shouldSwitchMonitor = true;
        switchDirection = "top";
      } else if (
        this.circle.y >= window.innerHeight - 80 &&
        this.canSwitchBottom
      ) {
        shouldSwitchMonitor = true;
        switchDirection = "bottom";
      }
    }

    // Apply position
    this.circle.element.style.left = `${this.circle.x}px`;
    this.circle.element.style.top = `${this.circle.y}px`;

    // Randomly change direction occasionally (only for automatic movement)
    if (
      !this.keys["w"] &&
      !this.keys["s"] &&
      !this.keys["a"] &&
      !this.keys["d"] &&
      !this.keys["arrowup"] &&
      !this.keys["arrowdown"] &&
      !this.keys["arrowleft"] &&
      !this.keys["arrowright"]
    ) {
      if (Math.random() < 0.02) {
        this.circle.dx = (Math.random() - 0.5) * 4;
        this.circle.dy = (Math.random() - 0.5) * 4;
      }
    }

    // Update debug info
    this.updateDebugInfo();
  }

  animate() {
    this.moveCircle();
    this.animationId = requestAnimationFrame(() => this.animate());
  }

  startAnimation() {
    this.animate();
  }

  destroy() {
    if (this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
  }
}

// Start the app when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
  new MovingCircleApp();
});
