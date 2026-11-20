// Each room has its own backdrop behind the pages (#118): soft paper hills
// with a felt texture, moss in the Yarn studio and violet in the Sewing room.
// The colors come from CSS (--hill-1 to --hill-3), so light and dark mode and
// each room only change variables.
export function RoomBackdrop() {
  return <div className="room-backdrop" aria-hidden="true">
    <svg viewBox="0 0 1440 900" preserveAspectRatio="none">
      <defs>
        <filter id="room-felt" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="7" result="noise"/>
          <feColorMatrix in="noise" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 .22 0" result="grain"/>
          <feComposite in="grain" in2="SourceGraphic" operator="in" result="felt"/>
          <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="felt"/></feMerge>
        </filter>
      </defs>
      <g filter="url(#room-felt)">
        <path className="room-hill room-hill-1" d="M0 520 C180 470 380 540 620 500 S1060 440 1440 490 L1440 900 L0 900 Z"/>
        <path className="room-hill room-hill-2" d="M0 660 C240 610 470 690 760 650 S1180 600 1440 640 L1440 900 L0 900 Z"/>
        <path className="room-hill room-hill-3" d="M0 790 C260 760 520 820 820 785 S1240 750 1440 780 L1440 900 L0 900 Z"/>
      </g>
    </svg>
  </div>;
}
