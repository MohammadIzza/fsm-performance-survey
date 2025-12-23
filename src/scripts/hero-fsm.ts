/** Adapt the preserved Nod controller without modifying its vendor chunks.
 * Loaded by SiteLayout before DOMContentLoaded; beforePageInit runs after
 * controller creation on both first load and Luge page transitions.
 */
type TweenVars = Record<string, unknown>;
interface Timeline {
  call(callback: () => void, params?: null, position?: number): Timeline;
  from(target: unknown, vars: TweenVars, position?: number): Timeline;
  fromTo(
    target: unknown,
    from: TweenVars,
    to: TweenVars,
    position?: number,
  ): Timeline;
  to(target: unknown, vars: TweenVars, position?: number): Timeline;
  kill(): void;
}
interface HeroController {
  el: HTMLElement;
  refs: {
    letter: HTMLElement[];
    flower: (HTMLElement & { play(): void })[];
    letters: HTMLElement;
    bootcamp: HTMLElement;
  };
  sectionHeight: number;
  illusHeight: number;
  pathPoints: Record<string, number>;
  setPathD(): void;
  introAnimation(): void;
  kill(): void;
  fsmAdapted?: boolean;
}
interface ThemeWindow extends Window {
  luge: { emitter: { on(event: string, callback: () => void): void } };
  webpackChunknod: { push(chunk: unknown[]): unknown };
}
interface ThemeModules {
  8520: {
    w$: {
      timeline(vars: TweenVars): Timeline;
      registerPlugin(plugin: unknown): void;
    };
  };
  124: { c: { create(name: string, curve: string): unknown } };
}
const theme = window as unknown as ThemeWindow;
// The module IDs belong to the pinned Nod runtime in public/assets/js.
// Reuse its GSAP ticker and CustomEase; do not ship a second animation engine.
theme.webpackChunknod.push([
  ['fsm-hero-adapter-v1'],
  {},
  (require: <K extends keyof ThemeModules>(id: K) => ThemeModules[K]) => {
    const gsap = require(8520).w$;
    const CustomEase = require(124).c;
    gsap.registerPlugin(CustomEase);
    const ease = CustomEase.create(
      'fsm-hero-rise',
      'M0,0 C0.315,0.48 0.195,0.699 0.448,0.908 0.658,1.081 0.855,1 1,1',
    );
    theme.luge.emitter.on('beforePageInit', () => {
      document
        .querySelectorAll<HTMLElement>('[data-fsm-hero]')
        .forEach((el) => {
          const controller = (
            el as HTMLElement & { plr?: { controller: HeroController } }
          ).plr?.controller;
          if (!controller || controller.fsmAdapted) return;
          controller.fsmAdapted = true;
          let timeline: Timeline | undefined;
          controller.introAnimation = function () {
            timeline?.kill();
            const tl = gsap.timeline({ onUpdate: this.setPathD.bind(this) });
            timeline = tl;
            tl.call(() => {
              this.refs.letters.style.clipPath = 'inset(-100vh -100vw 0)';
              this.el.classList.add('is-in');
              this.refs.bootcamp.style.opacity = '';
              this.refs.letters.style.opacity = '';
            });
            const timing = [
              { start: 0.4834, duration: 1.2166, play: 0.2167 },
              { start: 0.0667, duration: 1.5833, play: 0.2167 },
              { start: 0.5, duration: 1.3666, play: 0.5667 },
            ];
            this.refs.letter.forEach((letter, index) => {
              const t = timing[index];
              tl.from(
                letter,
                { y: '100%', ease, duration: t.duration },
                t.start,
              );
              tl.call(() => this.refs.flower[index].play(), null, t.play);
            });
            // Original wave, clipping release and UNDIP badge timing.
            tl.fromTo(
              this.pathPoints,
              { y1: this.sectionHeight, y3: this.sectionHeight },
              {
                y1: this.illusHeight,
                y3: this.illusHeight,
                ease: 'power2.out',
                duration: 0.617,
              },
              0.0667,
            );
            tl.fromTo(
              this.pathPoints,
              { y2: this.sectionHeight },
              {
                y2: this.illusHeight - 300,
                ease: 'power2.out',
                duration: 0.617,
              },
              0.0667,
            );
            tl.call(
              () => {
                this.refs.letters.style.clipPath = '';
              },
              null,
              0.6837,
            );
            tl.to(
              this.pathPoints,
              {
                y2: this.illusHeight,
                ease: 'elastic.out(1.2, 0.3)',
                duration: 1.8,
              },
              0.6837,
            );
            tl.from(
              this.refs.bootcamp,
              {
                y: '-10%',
                clipPath: 'polygon(0 50%, 100% 50%, 100% 50%, 0 50%)',
                ease: 'power3.inOut',
                duration: 0.8,
              },
              1.2334,
            );
          };
          const originalKill = controller.kill;
          controller.kill = function () {
            timeline?.kill();
            originalKill.call(this);
          };
        });
    });
  },
]);
