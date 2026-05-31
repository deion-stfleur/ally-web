/** Ally brand mark — same ✳ used in marketing nav. */
export default function AllyMark({ className = "" }) {
  return (
    <span className={className ? `ally-mark ${className}` : "ally-mark"} aria-hidden>
      ✳
    </span>
  );
}
