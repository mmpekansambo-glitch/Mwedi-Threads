import { useEffect, useRef, useState } from 'react';

// Landing page motion (#118): three watercolor frames cross-fade every 9
// seconds, and three glowing threads (violet, moss, clay) slowly draw across
// the page each time a frame comes in. With reduced motion the first frame
// stays and the threads are simply there.
const base = import.meta.env.BASE_URL;
const frames = [
  { src: `${base}landing/yarn-studio.webp`, caption: 'In the Yarn studio' },
  { src: `${base}landing/sewing-room.webp`, caption: 'In the Sewing room' },
  { src: `${base}landing/finished.webp`, caption: 'Finished, and worn' },
];
const frameSeconds = 9;

const threads = [
  { className: 'landing-thread-violet', d: 'M-20 760 C180 720 300 840 470 790 S760 650 900 720 S1180 860 1460 760' },
  { className: 'landing-thread-moss', d: 'M-20 800 C220 790 330 720 520 750 S800 830 980 760 S1240 650 1460 690' },
  { className: 'landing-thread-clay', d: 'M-20 830 C160 850 360 790 560 830 S880 740 1060 800 S1300 850 1460 820' },
];

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

export function LandingMotion() {
  const [frame, setFrame] = useState(0);
  const paths = useRef<(SVGPathElement | null)[]>([]);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const timer = window.setInterval(() => setFrame((current) => (current + 1) % frames.length), frameSeconds * 1000);
    return () => window.clearInterval(timer);
  }, []);

  // Draw the threads again whenever a new frame comes in.
  useEffect(() => {
    if (prefersReducedMotion()) return;
    paths.current.forEach((path, index) => {
      if (!path) return;
      const length = path.getTotalLength();
      path.style.transition = 'none';
      path.style.strokeDasharray = `${length}`;
      path.style.strokeDashoffset = `${length}`;
      path.getBoundingClientRect();
      path.style.transition = `stroke-dashoffset 6.5s cubic-bezier(.45,.05,.3,1) ${index * 0.7}s`;
      path.style.strokeDashoffset = '0';
    });
  }, [frame]);

  return <div className="landing-motion" aria-hidden="true">
    {frames.map((item, index) => <img key={item.src} src={item.src} alt="" className={`landing-frame${index === frame ? ' is-showing' : ''}`}/>)}
    <div className="landing-frame-fade"/>
    <svg className="landing-threads" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice">
      <defs><filter id="landing-glow" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="3" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
      {threads.map((thread, index) => <path key={thread.className} ref={(element) => { paths.current[index] = element; }} className={`landing-thread ${thread.className}`} d={thread.d} filter="url(#landing-glow)"/>)}
    </svg>
    <div className="landing-frame-dots">{frames.map((item, index) => <i key={item.src} className={index === frame ? 'is-showing' : ''}/>)}</div>
    <p className="landing-caption" key={frame}>{frames[frame].caption}</p>
  </div>;
}
