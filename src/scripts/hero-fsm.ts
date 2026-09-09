/**
 * Interactive Physics Controller for Hero FSM Letters
 * Implements smooth spring-damped stem swaying and head rotation driven by cursor movement and breathing oscillation.
 */

interface StemData {
  el: SVGElement;
  path: SVGPathElement;
  flower: HTMLElement;
  letter: HTMLElement;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  x2o: number;
  y2o: number;
  xv: number;
  force: number;
  height: number;
  angle: number;
  frequency: number;
  amplitude: number;
  originX: number;
  originY: number;
}

export function initHeroFSM(): void {
  const container = document.querySelector<HTMLElement>('.b-hero-home');
  if (!container) return;

  const letterEls = container.querySelectorAll<HTMLElement>('.js-letter');
  if (letterEls.length === 0) return;

  const stems: StemData[] = [];
  let isRunning = true;
  let lastTime = performance.now();

  const mouse = {
    x: 0,
    y: 0,
    prevX: 0,
    prevY: 0,
    vx: 0,
    vy: 0,
    speed: 0,
    hasMoved: false,
  };

  function setupStems(): void {
    stems.length = 0;
    letterEls.forEach((letter, i) => {
      const stem = letter.querySelector<SVGElement>('.js-stem');
      const path = stem?.querySelector<SVGPathElement>('.js-stem-path');
      const flower = letter.querySelector<HTMLElement>('.js-flower');

      if (!stem || !path || !flower) return;

      const rect = stem.getBoundingClientRect();
      const w = rect.width || 100;
      const h = rect.height || 300;
      const midX = w / 2;

      // Ensure SVG viewBox matches actual rendered size
      stem.setAttribute('width', `${w}`);
      stem.setAttribute('height', `${h}`);

      const stemData: StemData = {
        el: stem,
        path,
        flower,
        letter,
        x1: midX,
        y1: h,
        x2: midX,
        y2: 0,
        x2o: 0,
        y2o: 0,
        xv: 0,
        force: 0,
        height: h,
        angle: 0,
        frequency: 0.0012 + i * 0.0003,
        amplitude: 8 + (i % 2) * 5,
        originX: rect.left,
        originY: rect.top + window.scrollY,
      };

      stems.push(stemData);
    });
  }

  function onMouseMove(e: MouseEvent): void {
    if (!mouse.hasMoved) {
      mouse.prevX = e.clientX;
      mouse.prevY = e.clientY;
      mouse.hasMoved = true;
    }

    mouse.vx = e.clientX - mouse.prevX;
    mouse.vy = e.clientY - mouse.prevY;
    mouse.prevX = e.clientX;
    mouse.prevY = e.clientY;
    mouse.x = e.clientX;
    mouse.y = e.clientY;
    mouse.speed = Math.min(Math.hypot(mouse.vx, mouse.vy), 40);

    // Apply interactive impulse to nearby stems
    stems.forEach((stem) => {
      const topX = stem.originX + stem.x2 + stem.x2o;
      const topY = stem.originY + stem.y2 + stem.y2o;
      const dist = Math.hypot(mouse.x - topX, mouse.y - topY);
      const radius = 260;

      if (dist < radius) {
        const factor = 1 - dist / radius;
        const impulse = mouse.vx * factor * 0.35;
        stem.xv += Math.max(Math.min(impulse, 8), -8);
      }
    });
  }

  function updatePhysics(time: number): void {
    const dt = Math.min((time - lastTime) / 16.66, 2.0);
    lastTime = time;

    stems.forEach((stem) => {
      // Spring dampening
      stem.xv += (0 - stem.force) * 0.06 * dt;
      stem.xv *= Math.pow(0.92, dt);
      stem.force += stem.xv * dt;

      // Natural gentle breeze oscillation
      const oscillation = Math.sin(time * stem.frequency) * stem.amplitude;
      stem.x2o = stem.force + oscillation;

      // Calculate bending angle and vertical displacement
      const angleRad = Math.asin(
        Math.max(-0.6, Math.min(0.6, stem.x2o / stem.height)),
      );
      stem.angle = angleRad * (180 / Math.PI);
      stem.y2o = (1 - Math.cos(angleRad)) * stem.height * 0.4;

      // Quadratic Bezier curve control points
      const topX = stem.x2 + stem.x2o;
      const topY = stem.y2 + stem.y2o;
      const ctrlX = stem.x1 + stem.x2o * 0.45;
      const ctrlY = stem.y1 * 0.55;

      const pathStr = `M ${stem.x1} ${stem.y1} Q ${ctrlX} ${ctrlY} ${topX} ${topY} m -6 -6 a 6 6 0 1 0 12 0 a 6 6 0 1 0 -12 0`;
      stem.path.setAttribute('d', pathStr);

      // Rotate and position flower head at tip of stem
      stem.flower.style.transform = `translate3d(${stem.x2o}px, ${stem.y2o}px, 0) rotate(${stem.angle * 1.1}deg)`;
    });
  }

  function animate(time: number): void {
    if (!isRunning) return;
    updatePhysics(time);
    requestAnimationFrame(animate);
  }

  // Initial setup
  setupStems();

  // Intro animation
  letterEls.forEach((el, index) => {
    el.style.opacity = '0';
    el.style.transform = 'translate3d(0, 80px, 0)';
    setTimeout(
      () => {
        el.style.transition =
          'transform 1.1s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.8s ease';
        el.style.opacity = '1';
        el.style.transform = 'translate3d(0, 0, 0)';
        setTimeout(() => {
          el.style.transition = '';
        }, 1200);
      },
      150 + index * 180,
    );
  });

  // Event listeners
  window.addEventListener('mousemove', onMouseMove, { passive: true });
  window.addEventListener(
    'resize',
    () => {
      setupStems();
    },
    { passive: true },
  );

  requestAnimationFrame(animate);
}

// Auto-boot if DOM is already ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHeroFSM);
} else {
  initHeroFSM();
}
