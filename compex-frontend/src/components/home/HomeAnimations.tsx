"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export function HomeAnimations() {
  useEffect(() => {
    const revealEls = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const counterEls = Array.from(document.querySelectorAll<HTMLElement>("[data-counter]"));

    revealEls.forEach((el) => {
      const delay = parseFloat(el.dataset.delay ?? "0");
      gsap.set(el, { opacity: 0, y: 40 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 88%",
        onEnter: () =>
          gsap.to(el, { opacity: 1, y: 0, duration: 0.7, delay, ease: "power3.out" }),
      });
    });

    counterEls.forEach((el) => {
      const target = parseFloat(el.dataset.counter ?? "0");
      const suffix = el.dataset.suffix ?? "";
      const obj = { val: 0 };
      gsap.set(el, { opacity: 0, y: 20 });
      ScrollTrigger.create({
        trigger: el,
        start: "top 85%",
        onEnter: () => {
          gsap.to(el, { opacity: 1, y: 0, duration: 0.5 });
          gsap.to(obj, {
            val: target,
            duration: 1.8,
            ease: "power2.out",
            onUpdate: () => {
              el.textContent =
                Number.isInteger(target)
                  ? Math.round(obj.val).toLocaleString() + suffix
                  : obj.val.toFixed(1) + suffix;
            },
          });
        },
      });
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return null;
}
