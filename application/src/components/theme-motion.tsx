"use client";
import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { gsap } from "gsap";
import { withBase } from "@/lib/base-path";

/** Uses the original repository's Lottie art, with the same spring-like easing. */
export function ThemeMotion() {
 const root = useRef<HTMLDivElement>(null);
 useEffect(() => {
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  const animations: {destroy:()=>void;play:()=>void;pause:()=>void}[] = [];
  let disposed = false;
  import("lottie-web").then(({default:lottie}) => {
   if (disposed || !root.current) return;
   root.current.querySelectorAll<HTMLElement>("[data-animation]").forEach(el => {
    animations.push(lottie.loadAnimation({container:el,renderer:"svg",loop:true,autoplay:!reduced.matches,path:el.dataset.animation!}));
   });
  });
  const ctx = gsap.context(() => {
   if (!reduced.matches) gsap.to("[data-animation]", {rotation:8,y:-8,duration:2.5,stagger:.3,repeat:-1,yoyo:true,ease:"sine.inOut"});
  },root);
  const visibility = () => animations.forEach(a => document.hidden || reduced.matches ? a.pause() : a.play());
  document.addEventListener("visibilitychange",visibility);
  reduced.addEventListener("change",visibility);
  return () => {disposed=true;ctx.revert();animations.forEach(a=>a.destroy());document.removeEventListener("visibilitychange",visibility);reduced.removeEventListener("change",visibility)};
 },[]);
 return <div className="survey-motion" ref={root} aria-hidden="true">{["c","o","d"].map(letter=><div key={letter} data-animation={withBase(`/assets/lottie/home-hero-${letter}.json`)} />)}</div>;
}

export function ThemeReveal() {
 const pathname = usePathname();
 useEffect(()=>{
  if(window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const ctx=gsap.context(()=>{
   gsap.fromTo("main > div",{y:24,opacity:0},{y:0,opacity:1,duration:.7,ease:"power3.out",clearProps:"transform,opacity"});
   gsap.fromTo(".page-title",{y:18},{y:0,duration:.85,ease:"power3.out",clearProps:"transform"});
  });
  return ()=>ctx.revert();
 },[pathname]);
 return null;
}
