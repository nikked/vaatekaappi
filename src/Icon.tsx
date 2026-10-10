// Icons from mockups/index.html.
const PATHS = {
  hanger: (
    <>
      <path
        d="M12 7a2 2 0 1 1 2-2c0 1-2 1.5-2 3l9 6.5a1.5 1.5 0 0 1-.9 2.5H3.9a1.5 1.5 0 0 1-.9-2.5L12 8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  sparkle: (
    <>
      <path
        d="M12 3c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6zM18.5 15c.3 2 .9 2.6 2.5 3-1.6.4-2.2 1-2.5 3-.3-2-.9-2.6-2.5-3 1.6-.4 2.2-1 2.5-3z"
        fill="currentColor"
      />
    </>
  ),
  plus: (
    <>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </>
  ),
  heart: (
    <>
      <path
        d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </>
  ),
  "heart-fill": (
    <>
      <path
        d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z"
        fill="currentColor"
      />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.8" fill="currentColor" />
      <circle cx="12" cy="12" r="1.8" fill="currentColor" />
      <circle cx="19" cy="12" r="1.8" fill="currentColor" />
    </>
  ),
  down: (
    <>
      <path
        d="M12 4v11m-5-5 5 5 5-5M5 20h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  up: (
    <>
      <path
        d="M12 15V4M7 9l5-5 5 5M5 20h14"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  back: (
    <>
      <path
        d="M15 5l-7 7 7 7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  bike: (
    <>
      <circle
        cx="6"
        cy="16"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <circle
        cx="18"
        cy="16"
        r="3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
      />
      <path
        d="M6 16l4-7h6l2 7M10 9l3 7h-7M14 6h3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  shuffle: (
    <>
      <path
        d="M4 7h3c5 0 5 10 10 10h3m0 0-3-3m3 3-3 3M4 17h3c1.5 0 2.5-.8 3.3-2M20 7h-3c-1.5 0-2.5.8-3.3 2M20 7l-3-3m3 3-3 3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </>
  ),
  palette: (
    <>
      <path
        d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.9 1.8-1.8 0-.5-.2-.9-.5-1.2-.3-.3-.5-.7-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
      <circle cx="7.5" cy="11" r="1.3" fill="currentColor" />
      <circle cx="10.5" cy="7" r="1.3" fill="currentColor" />
      <circle cx="15" cy="7.5" r="1.3" fill="currentColor" />
    </>
  ),
} as const;

export type IconName = keyof typeof PATHS;

export const Icon = ({ name }: { name: IconName }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    {PATHS[name]}
  </svg>
);
