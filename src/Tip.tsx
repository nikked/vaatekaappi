import { type ReactNode, useId } from "react";

// Hover or focus shows the text; it is also the element's accessible description.
// `align` is the side the bubble lines up with, so it opens away from the card edge.
export const Tip = ({
  text,
  align = "start",
  children,
}: {
  text: string;
  align?: "start" | "end";
  children: ReactNode;
}) => {
  const id = useId();
  return (
    // biome-ignore lint/a11y/noNoninteractiveTabindex: focusable so keyboard users can read the tip too
    <span className={`tip tip-${align}`} tabIndex={0} aria-describedby={id}>
      {children}
      <span role="tooltip" id={id} className="tip-text">
        {text}
      </span>
    </span>
  );
};

/** A small "?" that explains the field next to it. */
export const HelpTip = ({ text }: { text: string }) => (
  <Tip text={text}>
    <span className="help-mark" aria-hidden="true">
      ?
    </span>
  </Tip>
);
