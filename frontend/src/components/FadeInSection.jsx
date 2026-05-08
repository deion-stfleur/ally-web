import { useEffect, useRef, useState } from "react";

/**
 * Fades and slides content in when it enters the viewport (once).
 * Hero and nav: usually visible on load; we still detect intersection on mount.
 */
export default function FadeInSection({ as: Tag = "div", className = "", children }) {
  const ref = useRef(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return undefined;
    }

    let reduce = false;
    try {
      reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch {
      /* ignore */
    }
    if (reduce) {
      setVisible(true);
      return undefined;
    }

    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -6% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const combined = ["alm-reveal", visible ? "is-visible" : "", className].filter(Boolean).join(" ");

  return (
    <Tag ref={ref} className={combined}>
      {children}
    </Tag>
  );
}
