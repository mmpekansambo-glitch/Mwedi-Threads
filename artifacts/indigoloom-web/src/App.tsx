import { type ReactNode, useEffect, useId, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useSignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  requestStashPhotoUpload, useAddProgress, useCreateProject, useDeleteProgressPhoto, useDeleteProject, useGetDashboard,
  usePreviewDesignerWebsiteTitle,
  useGetProject, useGetProjects, useStarProject, useUnstarProject, useUpdateProject,
  getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey,
  useCreateStashYarn, useDeleteStashYarn, useGetStashYarn, useGetStashYarns, useGetYarnCatalog, useUpdateStashYarn,
  getGetStashYarnQueryKey, getGetStashYarnsQueryKey, getGetYarnCatalogQueryKey,
  getGetCatalogReviewsQueryKey, getGetCatalogReviewAccessQueryKey, getGetSkeinSuggestionsQueryKey, getGetStashYarnReviewsQueryKey,
  useGetCatalogReviewAccess, useGetCatalogReviews, useGetStashYarnReviews, useResolveCatalogReview,
  requestFabricPhotoUpload, useCreateStashFabric, useDeleteStashFabric, useGetMyCrafts, useGetStashFabric, useGetStashFabrics, useUpdateMyCrafts, useUpdateStashFabric,
  getGetMyCraftsQueryKey, getGetStashFabricQueryKey, getGetStashFabricsQueryKey,
} from '@workspace/api-client-react';
import { CrochetHookSize, KnittingNeedleSize, NeedleCableLength } from '@workspace/api-client-react';
import type { CatalogField, CatalogReview, CreateProject, CreateProgress, Crafts, FabricConstruction, FabricPrint, FabricType, FabricUnit, GeneralColor, Project, ProjectStatus, StashFabric, StashYarn, UpdateProject, YarnWeight } from '@workspace/api-client-react';
import { FormProvider as Form, useForm, type UseFormReturn } from 'react-hook-form';
import {
  ArrowLeft, ArrowRight, ArrowUpDown, ArrowUpRight, BookOpen, Check,
  Camera, ChevronDown, ChevronUp, CircleHelp, Feather, Filter, Flower2,
  Layers3, LogOut, Menu, Palette, Plus, Scissors, Search, Sparkles, Star, Trash2,
  X,
} from 'lucide-react';
import { projectSorts, sortProjects, sortStash, stashSorts, useSavedSort } from './lib/sorting';
import {
  Link, Redirect, Route, Switch, useLocation, useSearch, Router as WouterRouter,
} from 'wouter';
import { StatDoodle } from '@/components/stat-doodles';
import { DateWheelField as ProjectDateField } from '@/components/date-wheel-field';
import {
  ProgressAmountField, ProgressMethodFields, amountDraftFor, defaultProgressSettings, progressAmountForApi,
  progressDetail, progressSettingsError, progressSettingsForApi, progressSettingsFromProject,
  type ProgressAmountDraft, type ProgressSettingsDraft,
} from '@/components/progress-method';
import { DashboardCharts } from '@/components/dashboard-charts';
import { ProgressBar, ProgressEntryCard, uploadProgressPhoto } from '@/components/progress-entry';
import {
  BlendFields, ColorDot, DidYouMean, GeneralColorPicker, WeightWheelField, blendForApi, generalColors, useSettledValue, weightLabel, yarnWeights,
  type BlendDraft,
} from '@/components/yarn-fields';
import {
  ProjectYarnsField, describeProjectYarn, yarnDraftsFromProject, yarnsForApi, type YarnDraft,
} from '@/components/project-yarns';
import { SkeinSuggestions } from '@/components/skein-suggestions';
import { ProjectCounter } from '@/components/project-counter';
import { NameReviewButton, NameReviewForm, NameReviewList, catalogFieldLabels } from '@/components/name-review';
import { ErrorBoundary } from '@/components/error-boundary';
import {
  fabricConstructions, fabricName, fabricPhotoUrl, fabricPrints, fabricSize, fabricTypes, fabricUnits, labelFor, maxFabricPhotos, sizeForApi,
} from '@/components/fabric-fields';
import { trackEvent, trackSuccessfulAction } from '@/lib/analytics';
import { Toaster } from '@/components/ui/toaster';
import { useAppearance, type AppearanceChoice } from '@/hooks/use-appearance';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/pages/not-found';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(window.location.hostname, import.meta.env.VITE_CLERK_PUBLISHABLE_KEY);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string) {
  return basePath && path.startsWith(basePath) ? path.slice(basePath.length) || '/' : path;
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#395B50',
    colorForeground: '#1F2F16',
    colorMutedForeground: '#5A7684',
    colorDanger: '#a3413f',
    colorBackground: '#FFFFFF',
    colorInput: '#EEF2F9',
    colorInputForeground: '#1F2F16',
    colorNeutral: '#DDE5F3',
    fontFamily: 'Figtree, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#FFFFFF] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#1F2F16] font-serif',
    headerSubtitle: 'text-[#5A7684]',
    socialButtonsBlockButtonText: 'text-[#1F2F16] font-medium',
    formFieldLabel: 'text-[#1F2F16] font-medium',
    footerActionLink: 'text-[#395B50] font-semibold',
    footerActionText: 'text-[#5A7684]',
    dividerText: 'text-[#5A7684]',
    identityPreviewEditButton: 'text-[#395B50]',
    formFieldSuccessText: 'text-[#395B50]',
    alertText: 'text-[#1F2F16]',
    logoBox: 'mb-4',
    logoImage: 'max-h-16',
    socialButtonsBlockButton: 'border-[#DDE5F3] bg-[#EEF2F9] hover:bg-[#DDE5F3]',
    formButtonPrimary: 'bg-[#395B50] hover:bg-[#2C4740] shadow-none',
    formFieldInput: 'bg-[#EEF2F9] border-[#DDE5F3] text-[#1F2F16]',
    footerAction: 'border-t border-[#DDE5F3]',
    dividerLine: 'bg-[#DDE5F3]',
    alert: 'bg-[#EEF2F9] border-[#DDE5F3]',
    otpCodeFieldInput: 'bg-[#EEF2F9] border-[#DDE5F3]',
    formFieldRow: 'mb-4',
    main: 'text-[#1F2F16]',
  },
};

function Mark({ light = false }: { light?: boolean }) {
  const id = useId();
  return <span className={`brand-mark ${light ? 'brand-mark-light' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 100 100"><clipPath id={`${id}-ring`}><circle cx="50" cy="50" r="42"/></clipPath><clipPath id={`${id}-ball`}><circle cx="50" cy="56" r="25"/></clipPath><circle cx="50" cy="50" r="44" className="bm-fill"/><g clipPath={`url(#${id}-ring)`}><path d="M21.3 79.8L76.2 27.3q2.5 -3.0 5.0 -0.5" fill="none" className="bm-hook" strokeWidth="4" strokeLinecap="round"/><circle cx="50" cy="56" r="25" className="bm-ball"/><g clipPath={`url(#${id}-ball)`} fill="none" className="bm-line" strokeWidth="2.6"><ellipse cx="27.5" cy="56" rx="7.0" ry="40.0" transform="rotate(-30 50 56)"/><ellipse cx="27.5" cy="56" rx="16.0" ry="40.0" transform="rotate(-30 50 56)"/><ellipse cx="27.5" cy="56" rx="25.0" ry="40.0" transform="rotate(-30 50 56)"/><ellipse cx="27.5" cy="56" rx="34.0" ry="40.0" transform="rotate(-30 50 56)"/><ellipse cx="27.5" cy="56" rx="43.0" ry="40.0" transform="rotate(-30 50 56)"/></g><path d="M65.0 76.0C75.0 89.8 79.0 71.7 94 74.2" fill="none" className="bm-thread" strokeWidth="2.2" strokeLinecap="round"/></g><circle cx="50" cy="50" r="44" fill="none" className="bm-ring" strokeWidth="5"/><circle cx="30.2" cy="22.7" r="5.5" className="bm-dot"/></svg>
  </span>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand-lockup ${light ? 'brand-light' : ''}`} data-testid="link-brand-home">
    <Mark light={light} /><span className="brand-words"><span className="brand-name">Mwedi</span><span className="brand-soft">Threads</span></span>
  </Link>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function Landing() {
  return <main className="landing">
    <nav className="landing-nav"><Brand /></nav>
    <section className="landing-hero">
      <div className="hero-copy">
        <h1>Your hands are busy.<br/><em>Let your mind rest.</em></h1>
        <p className="hero-lede">Keep every cast-on, color choice and almost-finished sleeve in one place. No streaks to keep and no pressure to finish, just a record of the things you make and the small steps that got you there.</p>
        <div className="hero-actions">
          <Link href="/sign-up" className="button button-primary" data-testid="link-get-started">Sign up</Link>
          <Link href="/sign-in" className="button button-outline" data-testid="link-sign-in">Sign in</Link>
        </div>
      </div>
      <div className="hero-art" aria-hidden="true">
        <div className="orbit orbit-one"/><div className="orbit orbit-two"/>
        <div className="thread thread-a"/><div className="thread thread-b"/>
        <div className="project-note">
          <div className="note-top"><span className="note-tag">IN THE MAKING</span><span className="note-dots">•••</span></div>
          <div className="swatch-art"><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/><span/></div>
          <div className="note-copy"><small>YOUR NEXT LITTLE WIN</small><strong>Juniper cardigan</strong><div className="mini-progress"><span/></div><div className="mini-progress-meta"><span>18 rows since Sunday</span><b>42%</b></div></div>
        </div>
        <div className="yarn-ball"><span/><span/><span/><span/></div>
        <div className="floating-note"><Sparkles size={14}/><span>one row at a time</span></div>
        <span className="hero-flower"><Flower2 size={38} strokeWidth={1.1}/></span>
      </div>
    </section>
    <LandingFooter/>
  </main>;
}

function LandingFooter() {
  return <footer className="landing-footer">
    <span>Made for makers, wherever the yarn takes you.</span>
    <div className="landing-footer-links"><Link href="/about" data-testid="link-about">About</Link><Link href="/sign-up">Your next project is waiting <ArrowRight size={15}/></Link></div>
  </footer>;
}

function AboutPage() {
  return <main className="landing landing-about">
    <nav className="about-nav"><Brand/></nav>
    <article className="about-page">
      <h1>About Mwedi Threads</h1>
      <img className="about-photo" src={`${basePath}/about-photo.jpg`} width={1200} height={800} alt="Mwengwe Mpekansambo smiling, surrounded by balls and skeins of yarn"/>
      <p>A crochet or knitting project lives in a lot of places at once: the pattern, the designer's page, the yarn label, the hook or needles, a photo of where you stopped. Those pieces end up spread across notes, bookmarks and camera rolls, and it is easy to lose your place. Mwedi Threads keeps the whole project journey together in one place.</p>

      <p>Mwedi Threads is the evolution of a vision for a platform that supports a fiber artist's whole journey: discover, plan, create, connect and grow. It starts with crocheters and knitters, and grows toward sourcing yarn, sharing patterns and the community around the craft.</p>

      <h2>What you can keep here</h2>
      <ul>
        <li>Every project, with its craft, status, pattern, designer and dates.</li>
        <li>The yarn you used (brand, type and color) and your hook or needles, with mm, US and UK sizes.</li>
        <li>Dated progress notes with photos, so you always know where you left off.</li>
        <li>Stars for your favorites, and a dashboard that shows your making habits over time.</li>
      </ul>

      <p className="about-credit">Made by Mwengwe Mpekansambo.</p>
    </article>
    <LandingFooter/>
  </main>;
}

function SignInPage() {
  return <div className="auth-screen"><div className="auth-ornament"><Brand/></div><div className="auth-panel"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}
function SignUpPage() {
  const { signUp } = useSignUp();
  const trackedSignupStart = useRef(false);
  const trackedSession = useRef<string | null>(null);

  useEffect(() => {
    if (trackedSignupStart.current) return;
    trackedSignupStart.current = true;
    trackEvent('signup_started');
  }, []);

  useEffect(() => {
    const sessionId = signUp?.createdSessionId;
    if (signUp?.status !== 'complete' || !sessionId || trackedSession.current === sessionId) return;

    const storageKey = `mwedi:account-completed:${sessionId}`;
    try {
      if (window.sessionStorage.getItem(storageKey)) {
        trackedSession.current = sessionId;
        return;
      }
      window.sessionStorage.setItem(storageKey, '1');
    } catch {
      // In-memory deduplication below still protects this mounted page.
    }

    trackedSession.current = sessionId;
    trackEvent('account_completed');
  }, [signUp?.createdSessionId, signUp?.status]);

  return <div className="auth-screen"><div className="auth-ornament"><Brand/></div><div className="auth-panel"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function ClerkCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => {
    let previous: string | null | undefined;
    const unsubscribe = addListener(({ user }) => {
      const next = user?.id ?? null;
      if (previous !== undefined && previous !== next) client.clear();
      previous = next;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function LoadingScreen({ label = 'Gathering your projects…' }: { label?: string }) {
  return <div className="loading-screen"><div className="loading-spool"><span/></div><p>{label}</p><div className="skeleton-line"/></div>;
}

type Craft = 'yarn' | 'sewing';
const homePaths: Record<Craft, string> = { yarn: '/dashboard', sewing: '/sewing/fabric' };

// If the craft switches can't be read, every page opens as it did before the
// Sewing room, with yarn on, instead of waiting or locking the maker out.
function useCrafts() {
  return useGetMyCrafts({ query: {
    queryKey: getGetMyCraftsQueryKey(),
    staleTime: 5 * 60 * 1000,
    retry: false,
    // Pages mount under the craft gate, so a refetch on mount after a failed
    // read would put the gate back into loading and mount them again.
    refetchOnMount: false,
    retryOnMount: false,
    select: (crafts): Crafts | undefined => (typeof crafts?.yarn === 'boolean' ? crafts : undefined),
  } });
}

function PrivateRoute({ children, craft = 'yarn' }: { children: ReactNode; craft?: Craft }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen label="Opening your workspace…"/>;
  if (!isSignedIn) return <Redirect to="/"/>;
  return <CraftGate craft={craft}>{children}</CraftGate>;
}

// Each page belongs to one craft. A page for a craft the maker has turned
// off sends them to the home they do use.
function CraftGate({ children, craft }: { children: ReactNode; craft: Craft }) {
  const crafts = useCrafts();
  if (crafts.isLoading) return <LoadingScreen label="Opening your workspace…"/>;
  if (!crafts.data) return <>{children}</>;
  if (crafts.data.needsChoice) return <CraftChoicePage/>;
  if (!crafts.data[craft]) return <Redirect to={homePaths[craft === 'yarn' ? 'sewing' : 'yarn']}/>;
  return <>{children}</>;
}

function CraftChoicePage() {
  const client = useQueryClient();
  const [, setLocation] = useLocation();
  const save = useUpdateMyCrafts();
  const choose = (choice: { yarn: boolean; sewing: boolean }) => save.mutate({ data: choice }, {
    onSuccess: (crafts) => {
      client.setQueryData(getGetMyCraftsQueryKey(), crafts);
      setLocation(homePaths[crafts.yarn ? 'yarn' : 'sewing']);
    },
  });
  const options = [
    { key: 'yarn', title: 'Yarn crafts', detail: 'Crochet and knitting', icon: <Palette size={22}/>, choice: { yarn: true, sewing: false } },
    { key: 'sewing', title: 'Sewing', detail: 'Fabric and garments', icon: <Scissors size={22}/>, choice: { yarn: false, sewing: true } },
    { key: 'both', title: 'Both', detail: 'Switch between them any time', icon: <Layers3 size={22}/>, choice: { yarn: true, sewing: true } },
  ];
  return <div className="auth-screen craft-choice-screen"><div className="auth-ornament"><Brand/></div>
    <div className="craft-choice loom-card">
      <h1 className="serif">What do you make?</h1>
      <div className="craft-choice-options">
        {options.map((option) => <button key={option.key} type="button" className="craft-choice-option" onClick={() => choose(option.choice)} disabled={save.isPending} data-testid={`button-craft-choice-${option.key}`}>
          {option.icon}<span><b>{option.title}</b><small>{option.detail}</small></span><ArrowRight size={17}/>
        </button>)}
      </div>
      <p className="craft-choice-note">You can turn crafts on or off later in Settings.</p>
      {save.isError && <p className="mutation-error" role="alert">We couldn’t save that just now. Please try again.</p>}
    </div>
  </div>;
}

const portalTitles = { dashboard: 'Overview', projects: 'My projects', stash: 'Yarn stash', reviews: 'Name reviews', fabric: 'Fabric stash' };
const homeNames: Record<Craft, string> = { yarn: 'Yarn studio', sewing: 'Sewing room' };

function PortalLayout({ children, active }: { children: ReactNode; active: keyof typeof portalTitles }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = user?.firstName || user?.username || 'Maker';
  const initials = displayName.slice(0, 1).toUpperCase();
  const reviewAccess = useGetCatalogReviewAccess({ query: { queryKey: getGetCatalogReviewAccessQueryKey(), staleTime: 5 * 60 * 1000 } });
  const crafts = useCrafts().data;
  const appearance = useAppearance();
  const home: Craft = active === 'fabric' ? 'sewing' : 'yarn';
  return <div className={`portal-shell home-${home}`}>
    <aside className={`side-rail ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="rail-brand"><Brand light/><button className="rail-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={19}/></button></div>
      {crafts?.yarn && crafts.sewing && <nav className="home-switcher" aria-label="Choose a home">
        {(['yarn', 'sewing'] as const).map((craft) => <Link key={craft} href={homePaths[craft]} className={home === craft ? 'selected' : ''} aria-current={home === craft ? 'page' : undefined} data-testid={`link-home-${craft}`}>{homeNames[craft]}</Link>)}
      </nav>}
      <nav className="rail-nav">
        {home === 'yarn' ? <>
          <Link href="/dashboard" className={`rail-link ${active === 'dashboard' ? 'selected' : ''}`} data-testid="link-dashboard"><Layers3 size={18}/><span>Overview</span></Link>
          <Link href="/projects" className={`rail-link ${active === 'projects' ? 'selected' : ''}`} data-testid="link-projects"><BookOpen size={18}/><span>My projects</span></Link>
          <Link href="/stash" className={`rail-link ${active === 'stash' ? 'selected' : ''}`} data-testid="link-stash"><Palette size={18}/><span>Yarn stash</span></Link>
          {reviewAccess.data?.reviewer && <Link href="/reviews" className={`rail-link ${active === 'reviews' ? 'selected' : ''}`} data-testid="link-reviews"><CircleHelp size={18}/><span>Name reviews</span></Link>}
        </> : <>
          <Link href="/sewing/fabric" className={`rail-link ${active === 'fabric' ? 'selected' : ''}`} data-testid="link-fabric"><Scissors size={18}/><span>Fabric stash</span></Link>
        </>}
      </nav>
      <div className="rail-bottom"><ProfileMenu initials={initials} displayName={displayName} crafts={crafts} appearance={appearance} onSignOut={() => signOut({ redirectUrl: basePath || '/' })}/></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-dismiss-navigation"/>}
    <main className="portal-main">
      <header className="portal-topbar"><button className="menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21}/></button><div className="breadcrumbs"><span>Mwedi Threads</span><i>/</i><b>{portalTitles[active]}</b></div><div className="topbar-end"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date())}</span><span className="top-avatar">{initials}</span></div></header>
      <div className="portal-content appear">{children}</div>
    </main>
  </div>;
}

const appearanceOptions: { value: AppearanceChoice; label: string }[] = [
  { value: 'system', label: 'Match computer' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

function ProfileMenu({ initials, displayName, crafts, appearance, onSignOut }: { initials: string; displayName: string; crafts: Crafts | undefined; appearance: ReturnType<typeof useAppearance>; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
  const client = useQueryClient();
  const save = useUpdateMyCrafts();
  // The last craft that's on can't be turned off, so there is always a home.
  const toggle = (craft: Craft) => {
    if (!crafts) return;
    const next = { yarn: crafts.yarn, sewing: crafts.sewing, [craft]: !crafts[craft] };
    if (!next.yarn && !next.sewing) return;
    save.mutate({ data: next }, { onSuccess: (saved) => client.setQueryData(getGetMyCraftsQueryKey(), saved) });
  };
  const menuRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (event: MouseEvent | KeyboardEvent) => {
      if (event instanceof KeyboardEvent ? event.key === 'Escape' : !menuRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  return <div className="profile-menu" ref={menuRef}>
    {open && <div className="profile-menu-list" role="menu">
      <div className="menu-settings">
        <div className="menu-settings-heading">Settings</div>
        {crafts && <div role="group" aria-labelledby="menu-crafts-label">
        <div className="menu-settings-label" id="menu-crafts-label">My crafts</div>
        {(['yarn', 'sewing'] as const).map((craft) => {
          const on = crafts[craft];
          const locked = on && !(craft === 'yarn' ? crafts.sewing : crafts.yarn);
          return <button key={craft} type="button" role="menuitemcheckbox" aria-checked={on} className="menu-switch" onClick={() => toggle(craft)} disabled={locked || save.isPending} title={locked ? 'Keep at least one craft on' : undefined} data-testid={`switch-craft-${craft}`}>
            <span>{craft === 'yarn' ? 'Yarn' : 'Sewing'}</span><span className={`switch-track${on ? ' on' : ''}`} aria-hidden="true"><i/></span>
          </button>;
        })}
        </div>}
        <div role="radiogroup" aria-labelledby="menu-appearance-label">
          <div className="menu-settings-label" id="menu-appearance-label">Appearance</div>
          <div className="appearance-choice">
            {appearanceOptions.map((option) => <button key={option.value} type="button" role="menuitemradio" aria-checked={appearance.choice === option.value} className={appearance.choice === option.value ? 'selected' : ''} onClick={() => appearance.choose(option.value)} data-testid={`button-appearance-${option.value}`}>{option.label}</button>)}
          </div>
        </div>
      </div>
      <button type="button" role="menuitem" onClick={onSignOut} data-testid="button-sign-out"><LogOut size={16}/> Sign out</button>
    </div>}
    <button type="button" className="profile-chip" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)} data-testid="button-profile-menu"><span className="profile-initial">{initials}</span><span className="profile-name">{displayName}</span><ChevronUp size={16}/></button>
  </div>;
}

function PageHeading({ overline, title, subtitle, action }: { overline?: string; title: ReactNode; subtitle?: string; action?: ReactNode }) {
  return <div className="page-heading"><div>{overline ? <div className="eyebrow"><span className="eyebrow-stitch"/>{overline}</div> : null}<h1 className="page-title serif">{title}</h1>{subtitle ? <p>{subtitle}</p> : null}</div>{action}</div>;
}

function QueryProblem({ retry, message = 'We couldn’t gather this just now.' }: { retry: () => void; message?: string }) {
  return <div className="query-problem"><span><CircleHelp size={20}/></span><h3>Something went wrong</h3><p>{message} Your work is safe. Please try again.</p><button className="button button-outline" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={16}/></button></div>;
}

function progressSummary(progress: { createdAt: string }[]): string {
  if (!progress.length) return 'No notes yet';
  const last = progress.reduce((latest, entry) => (entry.createdAt > latest ? entry.createdAt : latest), progress[0].createdAt);
  const day = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(last));
  return `${progress.length} ${progress.length === 1 ? 'note' : 'notes'} · last one ${day}`;
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const labels: Record<ProjectStatus, string> = { planning: 'Planning', in_progress: 'In progress', paused: 'On pause', completed: 'Finished' };
  return <span className={`status-pill status-${status}`} data-testid={`status-project-${status}`}>{status === 'completed' && <Check size={12}/>} {labels[status]}</span>;
}

function StarButton({ project, className = '' }: { project: Project; className?: string }) {
  const client = useQueryClient();
  const star = useStarProject();
  const unstar = useUnstarProject();
  const refresh = {
    onSettled: () => {
      void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetProjectQueryKey(project.id) });
      void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    },
  };
  const toggle = () => {
    if (project.starred) unstar.mutate({ projectId: project.id }, refresh);
    else star.mutate({ projectId: project.id }, refresh);
  };
  const label = project.starred ? `Remove star from ${project.title}` : `Star ${project.title}`;
  return <button type="button" className={`star-button${project.starred ? ' is-starred' : ''}${className ? ` ${className}` : ''}`} aria-pressed={project.starred} aria-label={label} title={project.starred ? 'Starred' : 'Star this project'} onClick={toggle} disabled={star.isPending || unstar.isPending} data-testid={`button-star-${project.id}`}><Star size={16} fill={project.starred ? 'currentColor' : 'none'}/></button>;
}

function ProjectCard({ project }: { project: Project }) {
  const craftLabel = project.craft === 'knitting' ? 'Knitting' : 'Crochet';
  return <div className="project-card-wrap"><StarButton project={project} className="card-star"/><Link href={`/projects/${project.id}`} className="project-card loom-card lift" data-testid={`card-project-${project.id}`}>
    <div className="project-card-body"><div className="project-card-meta"><StatusPill status={project.status}/></div><h3>{project.title}</h3><p>{[craftLabel, project.patternName].filter(Boolean).join(' · ')}</p><div className="card-progress"><ProgressBar value={project.completionPercent}/><span>{project.completionPercent}%</span></div><div className="card-foot">{yarnSummary(project) && <span>{yarnSummary(project)}</span>}{project.updatedAt && <span className="updated-label">Updated {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(project.updatedAt))}</span>}</div></div>
  </Link></div>;
}

function DashboardPage() {
  const query = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const data = query.data;
  const { user } = useUser();
  const name = user?.firstName || 'maker';
  return <PortalLayout active="dashboard">
    <PageHeading title={<>Hi, {name}</>} action={<Link href="/projects/new" className="button button-primary" data-testid="link-new-project"><Plus size={17}/> New project</Link>}/>
    {query.isLoading ? <div className="dashboard-loading"><div className="stat-skeleton"/><div className="stat-skeleton"/><div className="stat-skeleton"/></div> : query.isError || !data ? <QueryProblem retry={() => query.refetch()}/> : <>
      <section className="stat-row" aria-label="Project totals">
        <Link href="/projects" className="stat-card stat-card-all" data-testid="link-stat-all"><span className="stat-label">All projects</span><strong>{data.totalProjects}</strong><StatDoodle kind="yarn"/></Link>
        <Link href="/projects?status=in_progress" className="stat-card stat-card-active" data-testid="link-stat-in-progress"><span className="stat-label">In progress</span><strong>{data.activeProjects}</strong><StatDoodle kind="hook"/></Link>
        <Link href="/projects?status=completed" className="stat-card stat-card-finished" data-testid="link-stat-finished"><span className="stat-label">Finished</span><strong>{data.completedProjects}</strong><StatDoodle kind="square"/></Link>
      </section>
      <DashboardCharts charts={data.charts}/>
      <section className="dashboard-grid">
        <div className="dashboard-work">
          <div className="section-heading"><div><h2 className="serif">Recent projects</h2></div><Link href="/projects" className="quiet-link" data-testid="link-view-all-projects">All projects <ArrowRight size={15}/></Link></div>
          {data.recentProjects.length ? <div className="project-card-grid">{data.recentProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project}/>)}</div> : <EmptyProjects compact/>}
        </div>
        <aside className="recent-panel loom-card">
          <div className="section-heading"><div><h2 className="serif">Recent notes</h2></div></div>
          {data.recentProgress.length ? <div className="notes-list">{data.recentProgress.slice(0, 5).map((item, index) => <Link key={`${item.projectId}-${item.createdAt}`} href={`/projects/${item.projectId}`} className="note-row" data-testid={`link-progress-note-${index}`}><span className="note-dot"/><span className="note-row-copy"><b>{item.projectTitle}</b><span>{item.notes}</span><small>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.createdAt))} · now {item.completionPercent}%</small></span><ArrowUpRight size={14}/></Link>)}</div> : <div className="notes-empty"><p>No progress notes yet.</p></div>}
        </aside>
      </section>
    </>}
  </PortalLayout>;
}

function EmptyProjects({ compact = false }: { compact?: boolean }) {
  return <div className={`empty-projects ${compact ? 'empty-compact' : ''}`}><h3>No projects yet</h3><p>Add your first project to start tracking it.</p><Link href="/projects/new" className="button button-primary" data-testid="link-create-first-project"><Plus size={16}/> Start a project</Link></div>;
}

const projectStatuses: ProjectStatus[] = ['planning', 'in_progress', 'paused', 'completed'];

function ProjectsPage() {
  const [search, setSearch] = useState('');
  // The status filter lives in the URL, so the Overview stat cards and chart bars can link straight to it.
  const [, setLocation] = useLocation();
  const urlStatus = new URLSearchParams(useSearch()).get('status') ?? '';
  const status = projectStatuses.includes(urlStatus as ProjectStatus) ? urlStatus : '';
  const setStatus = (value: string) => setLocation(value ? `/projects?status=${value}` : '/projects', { replace: true });
  const [craft, setCraft] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
  const [sort, setSort] = useSavedSort('mwedi:projects-sort', projectSorts);
  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status: status as ProjectStatus } : {}),
    ...(craft ? { craft: craft as 'knitting' | 'crochet' } : {}),
    ...(starredOnly ? { starred: true } : {}),
  };
  const clearFilters = () => { setSearch(''); setStatus(''); setCraft(''); setStarredOnly(false); };
  const query = useGetProjects(params, { query: { queryKey: getGetProjectsQueryKey(params) } });
  return <PortalLayout active="projects">
    <PageHeading title="My projects" action={<Link href="/projects/new" className="button button-primary" data-testid="link-add-project"><Plus size={17}/> Add a project</Link>}/>
    <div className="catalog-tools">
      <label className="search-box"><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by name, pattern or yarn…" aria-label="Search projects" data-testid="input-search-projects"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15}/></button>}</label>
      <label className="select-wrap"><Filter size={15}/><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-status-filter"><option value="">Every status</option><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select><ChevronDown size={14}/></label>
      <label className="select-wrap"><select aria-label="Filter by craft" value={craft} onChange={(event) => setCraft(event.target.value)} data-testid="select-craft-filter"><option value="">Every craft</option><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select><ChevronDown size={14}/></label>
      <label className="select-wrap"><ArrowUpDown size={15}/><select aria-label="Sort projects" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} data-testid="select-project-sort">{projectSorts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      <button type="button" className={`starred-filter${starredOnly ? ' is-active' : ''}`} aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)} data-testid="button-starred-filter"><Star size={14} fill={starredOnly ? 'currentColor' : 'none'}/> Starred</button>
      {(search || status || craft || starredOnly) && <button className="clear-filters" onClick={clearFilters} data-testid="button-clear-filters">Clear filters</button>}
    </div>
    <div className="catalog-result-caption">{query.data ? <><b>{query.data.length}</b> {query.data.length === 1 ? 'project' : 'projects'}</> : null}</div>
    {query.isLoading ? <div className="project-card-grid">{[0, 1, 2].map((item) => <div className="card-skeleton" key={item}/>)}</div> : query.isError ? <QueryProblem retry={() => query.refetch()}/> : query.data?.length ? <div className="project-card-grid catalog-grid">{sortProjects(query.data, sort).map((project) => <ProjectCard key={project.id} project={project}/>)}</div> : starredOnly && !search && !status && !craft ? <div className="no-results"><Star size={23}/><h3>No starred projects yet</h3><p>Tap the star on any project to keep your favorites here.</p><button className="button button-outline" onClick={clearFilters} data-testid="button-reset-filters">Show all projects</button></div> : search || status || craft || starredOnly ? <div className="no-results"><Search size={23}/><h3>No projects match</h3><p>Try a different search or clear a filter.</p><button className="button button-outline" onClick={clearFilters} data-testid="button-reset-filters">Reset filters</button></div> : <EmptyProjects/>}
  </PortalLayout>;
}

type ProjectDatePrecision = Project['startedAtPrecision'];

function dateForProjectForm(value: string | null | undefined, precision: ProjectDatePrecision): string {
  if (!value) return '';
  return precision === 'month' ? value.slice(0, 7) : value.slice(0, 10);
}

function dateForProjectApi(value: string, precision: ProjectDatePrecision): string | null {
  if (!value) return null;
  return precision === 'month' ? `${value.slice(0, 7)}-01` : value;
}

function formatProjectDate(value: string | null | undefined, precision: ProjectDatePrecision): string {
  if (!value) return '';
  const [year, month, day] = value.slice(0, 10).split('-');
  if (!year || !month) return value;
  return precision === 'month'
    ? `${month}/${year.slice(-2)}`
    : `${month}/${day}/${year.slice(-2)}`;
}

function yarnSummary(project: Project): string {
  const [first, ...rest] = project.yarns;
  if (!first) return project.yarn || '';
  return rest.length ? `${describeProjectYarn(first)} + ${rest.length} more` : describeProjectYarn(first);
}

function ProjectYarnList({ project }: { project: Project }) {
  if (!project.yarns.length) return <>{project.yarn || 'Not added yet'}</>;
  return <ul className="project-yarn-list" data-testid="list-project-yarns">{project.yarns.map((yarn) => <li key={yarn.id}>
    {yarn.heldTogether && <span className="held-mark">Held with the yarn above</span>}
    <span className="project-yarn-name"><ColorDot color={yarn.generalColor}/>{yarn.stashYarnId ? <Link href={`/stash/${yarn.stashYarnId}`}>{describeProjectYarn(yarn)}</Link> : describeProjectYarn(yarn)}</span>
    {yarn.skeinsUsed !== null && <span className="project-yarn-skeins">{yarn.skeinsUsed} {yarn.skeinsUsed === 1 ? 'skein' : 'skeins'} used</span>}
  </li>)}</ul>;
}

type DesignerMode = 'name' | 'website';

function isHttpWebsiteUrl(value: string) {
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:') && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function DesignerEntry({
  form,
  mode,
  onModeChange,
  onPreview,
  onClearPreview,
  isPreviewing,
  message,
  prefix,
}: {
  form: UseFormReturn<ProjectFormValues>;
  mode: DesignerMode;
  onModeChange: (mode: DesignerMode) => void;
  onPreview: () => void;
  onClearPreview: () => void;
  isPreviewing: boolean;
  message: string;
  prefix: 'create' | 'edit';
}) {
  const pageTitle = form.watch('designerPageTitle');
  const websiteRegistration = form.register('designerWebsite', {
    validate: (value) => mode !== 'website' || !value || isHttpWebsiteUrl(value) || 'Enter a website link starting with http:// or https://.',
  });

  const inputId = mode === 'name' ? `${prefix}-pattern-designer` : `${prefix}-designer-website`;
  return <div className="field-block designer-entry field-wide">
    <label htmlFor={inputId}>Designer</label>
    <div className="designer-row">
      <div className="designer-mode-switch" role="group" aria-label="Designer entry option">
        <button type="button" aria-pressed={mode === 'name'} className={mode === 'name' ? 'selected' : ''} onClick={() => onModeChange('name')} data-testid={`button-${prefix}-designer-name`}>Name</button>
        <button type="button" aria-pressed={mode === 'website'} className={mode === 'website' ? 'selected' : ''} onClick={() => onModeChange('website')} data-testid={`button-${prefix}-designer-website`}>Website link</button>
      </div>
      {mode === 'name' ? (
        <input id={inputId} placeholder="Who made the pattern?" {...form.register('patternDesigner')} data-testid={prefix === 'create' ? 'input-pattern-designer' : 'input-edit-designer'}/>
      ) : <>
        <input id={inputId} type="url" autoCapitalize="none" autoCorrect="off" placeholder="https://example.com" {...websiteRegistration} onChange={(event) => { void websiteRegistration.onChange(event); form.setValue('designerPageTitle', '', { shouldDirty: true }); form.setValue('patternDesigner', '', { shouldDirty: true }); onClearPreview(); }} data-testid={`input-${prefix}-designer-website`}/>
        <button type="button" className="button button-outline designer-preview-button" onClick={onPreview} disabled={isPreviewing} data-testid={`button-${prefix}-preview-designer-title`}>{isPreviewing ? 'Previewing…' : 'Preview page title'}</button>
      </>}
    </div>
    {mode === 'website' && <>
      {form.formState.errors.designerWebsite?.message && <p className="field-error" role="alert">{form.formState.errors.designerWebsite.message}</p>}
      <input type="hidden" {...form.register('designerPageTitle')}/>
      {pageTitle && <div className="designer-page-preview" role="status" data-testid="designer-page-title-preview"><span>Page title preview</span><strong>{pageTitle}</strong></div>}
      {message && <p className="designer-preview-message" role="status">{message}</p>}
    </>}
  </div>;
}

type ProjectFormValues = {
  title: string; craft: 'knitting' | 'crochet'; status: ProjectStatus;
  description: string; patternName: string; patternDesigner: string;
  designerWebsite: string; designerPageTitle: string;
  tools: string; hookSize: HookSize | ''; hasSecondHook: boolean; secondHookSize: HookSize | '';
  needleSize: NeedleSize | ''; needleType: NeedleType | ''; needleCableLength: CableLength | '';
  hasSecondNeedle: boolean;
  secondNeedleSize: NeedleSize | ''; secondNeedleType: NeedleType | ''; secondNeedleCableLength: CableLength | '';
  startedAt: string; startedAtPrecision: ProjectDatePrecision;
  targetDate: string; targetDatePrecision: ProjectDatePrecision;
  completedAt: string; completedAtPrecision: ProjectDatePrecision;
};

type HookSize = NonNullable<CreateProject['hookSize']>;
const crochetHookSizes = Object.values(CrochetHookSize) as HookSize[];

function hooksForApi(values: ProjectFormValues) {
  const crochet = values.craft === 'crochet';
  return {
    hookSize: crochet ? values.hookSize || null : null,
    secondHookSize: crochet && values.hasSecondHook ? values.secondHookSize || null : null,
  };
}

function HookFields({ form, idPrefix, children }: { form: UseFormReturn<ProjectFormValues>; idPrefix: 'project' | 'edit'; children?: ReactNode }) {
  const testId = (name: string) => `select-${idPrefix === 'edit' ? 'edit-' : ''}${name}`;
  const sizeOptions = <><option value="">Choose a hook size</option>{crochetHookSizes.map((hookSize) => <option key={hookSize} value={hookSize}>{hookSize}</option>)}</>;
  return <>
    <div className="field-block"><label htmlFor={`${idPrefix}-hook-size`}>Hook size</label><select id={`${idPrefix}-hook-size`} {...form.register('hookSize')} data-testid={testId('crochet-hook-size')}>{sizeOptions}</select>{children}</div>
    {form.watch('hasSecondHook')
      ? <div className="field-block"><div className="hook-label-row"><label htmlFor={`${idPrefix}-second-hook-size`}>Second hook</label><button type="button" className="needle-remove" onClick={() => form.setValue('hasSecondHook', false)} data-testid={`button-${idPrefix}-remove-second-hook`}>Remove</button></div><select id={`${idPrefix}-second-hook-size`} {...form.register('secondHookSize')} data-testid={testId('second-hook-size')}>{sizeOptions}</select></div>
      : <button type="button" className="button button-quiet needle-add field-wide" onClick={() => form.setValue('hasSecondHook', true)} data-testid={`button-${idPrefix}-add-second-hook`}><Plus size={15}/> Add a second hook</button>}
  </>;
}

type NeedleSize = NonNullable<CreateProject['needleSize']>;
type NeedleType = NonNullable<CreateProject['needleType']>;
type CableLength = NonNullable<CreateProject['needleCableLength']>;
const needleSizes = Object.values(KnittingNeedleSize) as NeedleSize[];
const cableLengths = Object.values(NeedleCableLength) as CableLength[];
const needleTypeLabels: Record<NeedleType, string> = {
  straight: 'Straight', circular: 'Circular', double_pointed: 'Double-pointed', interchangeable: 'Interchangeable',
};
const needleHasCable = (type: NeedleType | '' | null | undefined) => type === 'circular' || type === 'interchangeable';
const emptyNeedleValues = {
  needleSize: '', needleType: '', needleCableLength: '', hasSecondNeedle: false,
  secondNeedleSize: '', secondNeedleType: '', secondNeedleCableLength: '',
} as const;

function needlesForApi(values: ProjectFormValues) {
  const knitting = values.craft === 'knitting';
  const second = knitting && values.hasSecondNeedle;
  return {
    needleSize: knitting ? values.needleSize || null : null,
    needleType: knitting ? values.needleType || null : null,
    needleCableLength: knitting && needleHasCable(values.needleType) ? values.needleCableLength || null : null,
    secondNeedleSize: second ? values.secondNeedleSize || null : null,
    secondNeedleType: second ? values.secondNeedleType || null : null,
    secondNeedleCableLength: second && needleHasCable(values.secondNeedleType) ? values.secondNeedleCableLength || null : null,
  };
}

function needleValuesFromProject(project: Project): Pick<ProjectFormValues, keyof typeof emptyNeedleValues> {
  return {
    needleSize: project.needleSize || '', needleType: project.needleType || '', needleCableLength: project.needleCableLength || '',
    hasSecondNeedle: Boolean(project.secondNeedleSize || project.secondNeedleType),
    secondNeedleSize: project.secondNeedleSize || '', secondNeedleType: project.secondNeedleType || '', secondNeedleCableLength: project.secondNeedleCableLength || '',
  };
}

function describeNeedle(size: string | null, type: NeedleType | null, cable: string | null) {
  const kind = type ? needleTypeLabels[type] + (needleHasCable(type) && cable ? `, ${cable}` : '') : '';
  return [size, kind].filter(Boolean).join(' · ');
}

function NeedleFields({ form, idPrefix }: { form: UseFormReturn<ProjectFormValues>; idPrefix: string }) {
  const testId = (name: string) => `select-${idPrefix === 'edit' ? 'edit-' : ''}${name}`;
  const needle = (label: string, prefix: 'needle' | 'secondNeedle', remove?: () => void) => {
    const type = form.watch(`${prefix}Type`);
    const name = prefix === 'needle' ? 'needle' : 'second-needle';
    return <div className="yarn-group field-wide" data-testid={`group-${idPrefix}-${name}`}>
      <div className="yarn-group-heading"><b>{label}</b>{remove && <button type="button" className="needle-remove" onClick={remove} data-testid={`button-${idPrefix}-remove-second-needle`}>Remove</button>}</div>
      <div className="yarn-trifold">
        <div className="field-block"><label htmlFor={`${idPrefix}-${name}-size`}>Size</label><select id={`${idPrefix}-${name}-size`} {...form.register(`${prefix}Size`)} data-testid={testId(`${name}-size`)}><option value="">Choose a size</option>{needleSizes.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
        <div className="field-block"><label htmlFor={`${idPrefix}-${name}-type`}>Type</label><select id={`${idPrefix}-${name}-type`} {...form.register(`${prefix}Type`)} data-testid={testId(`${name}-type`)}><option value="">Choose a type</option>{(Object.keys(needleTypeLabels) as NeedleType[]).map((option) => <option key={option} value={option}>{needleTypeLabels[option]}</option>)}</select></div>
        {needleHasCable(type) && <div className="field-block"><label htmlFor={`${idPrefix}-${name}-cable`}>Cable length</label><select id={`${idPrefix}-${name}-cable`} {...form.register(`${prefix}CableLength`)} data-testid={testId(`${name}-cable`)}><option value="">Choose a length</option>{cableLengths.map((length) => <option key={length} value={length}>{length}</option>)}</select></div>}
      </div>
    </div>;
  };
  return <>
    {needle('Needle', 'needle')}
    {form.watch('hasSecondNeedle')
      ? needle('Second needle', 'secondNeedle', () => form.setValue('hasSecondNeedle', false))
      : <button type="button" className="button button-quiet needle-add field-wide" onClick={() => form.setValue('hasSecondNeedle', true)} data-testid={`button-${idPrefix}-add-second-needle`}><Plus size={15}/> Add a second needle</button>}
  </>;
}

function ProjectFormPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateProject();
  const previewTitle = usePreviewDesignerWebsiteTitle();
  const [designerMode, setDesignerMode] = useState<DesignerMode>('name');
  const [designerPreviewMessage, setDesignerPreviewMessage] = useState('');
  const [progressSettings, setProgressSettings] = useState<ProgressSettingsDraft>(defaultProgressSettings);
  const [showProgressSettingsError, setShowProgressSettingsError] = useState(false);
  const [yarns, setYarns] = useState<YarnDraft[]>([]);
  const [yarnsError, setYarnsError] = useState('');
  const form = useForm<ProjectFormValues>({
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', designerWebsite: '', designerPageTitle: '', tools: '', hookSize: '', hasSecondHook: false, secondHookSize: '', ...emptyNeedleValues, startedAt: '', startedAtPrecision: 'day', targetDate: '', targetDatePrecision: 'day', completedAt: '', completedAtPrecision: 'day' },
  });
  const previewDesignerTitle = () => {
    const websiteUrl = form.getValues('designerWebsite').trim();
    if (!websiteUrl) {
      setDesignerPreviewMessage('Enter a website link first.');
      return;
    }
    setDesignerPreviewMessage('');
    previewTitle.mutate({ data: { websiteUrl } }, {
      onSuccess: (result) => {
        if (form.getValues('designerWebsite').trim() !== websiteUrl) return;
        form.setValue('designerWebsite', result.websiteUrl, { shouldDirty: true });
        form.setValue('designerPageTitle', result.pageTitle || '', { shouldDirty: true });
        form.setValue('patternDesigner', result.designerName, { shouldDirty: true });
        if (!result.pageTitle) setDesignerPreviewMessage('No page title was found. You can still save the link.');
      },
      onError: () => setDesignerPreviewMessage('We could not preview that website. Check the link and try again.'),
    });
  };
  const submit = form.handleSubmit((values) => {
    if (progressSettingsError(progressSettings)) {
      setShowProgressSettingsError(true);
      return;
    }
    const yarnList = yarnsForApi(yarns);
    setYarnsError(typeof yarnList === 'string' ? yarnList : '');
    if (typeof yarnList === 'string') return;
    const payload: CreateProject = {
      title: values.title.trim(), craft: values.craft, status: values.status,
      description: values.description || null, patternName: values.patternName || null,
      patternDesigner: values.patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? values.designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? values.designerPageTitle.trim() || null : null,
      yarn: null,
      yarns: yarnList,
      tools: values.tools || null,
      ...hooksForApi(values),
      ...needlesForApi(values),
      startedAt: dateForProjectApi(values.startedAt, values.startedAtPrecision),
      startedAtPrecision: values.startedAtPrecision,
      targetDate: dateForProjectApi(values.targetDate, values.targetDatePrecision),
      targetDatePrecision: values.targetDatePrecision,
      ...progressSettingsForApi(progressSettings),
    };
    create.mutate({ data: payload }, {
      onSuccess: trackSuccessfulAction('project_created', (project: Project) => {
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
        setLocation(`/projects/${project.id}`);
      }),
    });
  });
  return <PortalLayout active="projects">
    <Link href="/projects" className="back-link" data-testid="link-back-projects"><ArrowLeft size={16}/> Back to projects</Link>
    <PageHeading title="New project"/>
    <Form {...form}><form className="project-form loom-card" onSubmit={submit} noValidate>
      <div className="form-grid">
        <div className="field-block field-wide"><label htmlFor="project-title">Project name <b>*</b></label><input id="project-title" maxLength={160} placeholder="e.g. Juniper cardigan" {...form.register('title', { required: 'Give your project a name to get started.' })} data-testid="input-project-title"/>{form.formState.errors.title && <span className="field-error">{form.formState.errors.title.message}</span>}</div>
        <div className="field-block"><label htmlFor="project-craft">Craft</label><select id="project-craft" {...form.register('craft')} data-testid="select-project-craft"><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select></div>
        <div className="field-block"><label htmlFor="project-status">Status</label><select id="project-status" {...form.register('status')} data-testid="select-project-status"><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select></div>
        <ProgressMethodFields value={progressSettings} onChange={setProgressSettings} prefix="create" error={showProgressSettingsError ? progressSettingsError(progressSettings) : ''}/>
      </div>
      <div className="form-divider"><span>Pattern and materials</span><i/></div>
      <div className="form-grid">
        <div className="field-block"><label htmlFor="pattern-name">Pattern name</label><input id="pattern-name" placeholder="Pattern or source" {...form.register('patternName')} data-testid="input-pattern-name"/></div>
        <DesignerEntry form={form} mode={designerMode} onModeChange={(mode) => { setDesignerMode(mode); setDesignerPreviewMessage(''); }} onPreview={previewDesignerTitle} onClearPreview={() => setDesignerPreviewMessage('')} isPreviewing={previewTitle.isPending} message={designerPreviewMessage} prefix="create"/>
        <ProjectYarnsField value={yarns} onChange={(value) => { setYarns(value); setYarnsError(''); }} idPrefix="project" error={yarnsError}/>
        {form.watch('craft') === 'crochet' ? (
          <HookFields form={form} idPrefix="project"/>
        ) : (
          <NeedleFields form={form} idPrefix="project"/>
        )}
        <ProjectDateField id="project-start" label="Started on" value={form.watch('startedAt')} precision={form.watch('startedAtPrecision')} onValueChange={(value) => form.setValue('startedAt', value)} onPrecisionChange={(precision) => form.setValue('startedAtPrecision', precision)} testId="input-start-date"/>
        <ProjectDateField id="project-target" label="Aiming for (optional)" value={form.watch('targetDate')} precision={form.watch('targetDatePrecision')} onValueChange={(value) => form.setValue('targetDate', value)} onPrecisionChange={(precision) => form.setValue('targetDatePrecision', precision)} testId="input-target-date"/>
        <div className="field-block field-wide"><label htmlFor="project-description">Notes to future you</label><textarea id="project-description" rows={3} placeholder="What made you fall for this one?" {...form.register('description')} data-testid="input-project-description"/></div>
      </div>
      {create.isError && <p className="mutation-error" role="alert">We couldn't save that project just now. Your details are still here — please try again.</p>}
      <div className="form-actions"><Link href="/projects" className="button button-quiet" data-testid="link-cancel-project">Maybe later</Link><button type="submit" className="button button-primary" disabled={create.isPending} data-testid="button-save-project">{create.isPending ? 'Tucking it away…' : 'Save this project'}{!create.isPending && <ArrowRight size={16}/>}</button></div>
    </form></Form>
  </PortalLayout>;
}

function inferredDesignerName(websiteUrl: string): string {
  try {
    const hostname = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\d*\./, '');
    const labels = hostname.split('.');
    const suffixes = new Set(['com', 'org', 'net', 'edu', 'gov', 'mil', 'int', 'io', 'co', 'uk', 'ca', 'au', 'nz', 'info', 'biz', 'dev', 'app', 'studio', 'shop', 'art']);
    const subdomains = new Set(['shop', 'store', 'blog', 'patterns']);
    const name = labels.find((label) => label && !suffixes.has(label) && !subdomains.has(label)) || labels[0];
    return name.split(/[-_]+/).filter(Boolean).map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`).join(' ') || websiteUrl;
  } catch {
    return websiteUrl.replace(/^[a-z]+:\/\/(?:www\.)?/i, '').split(/[/?#]/)[0] || websiteUrl;
  }
}

function designerWebsiteLabel(websiteUrl: string, pageTitle: string | null, designerName: string | null): string {
  const title = pageTitle?.trim();
  if (title && title.length <= 72) return title;
  return designerName?.trim() || inferredDesignerName(websiteUrl);
}

function ProjectDetailPage({ projectId }: { projectId: string }) {
  const query = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId) } });
  const [editing, setEditing] = useState(false);
  const previewTitle = usePreviewDesignerWebsiteTitle();
  const [designerMode, setDesignerMode] = useState<DesignerMode>('name');
  const [designerPreviewMessage, setDesignerPreviewMessage] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [showProgress, setShowProgress] = useState(false);
  const [progressPhoto, setProgressPhoto] = useState<File | null>(null);
  const [progressPhotoPreview, setProgressPhotoPreview] = useState('');
  const [progressPhotoError, setProgressPhotoError] = useState('');
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const update = useUpdateProject();
  const remove = useDeleteProject();
  const removeProgressPhoto = useDeleteProgressPhoto();
  const [photoRemovalError, setPhotoRemovalError] = useState('');
  const [removingPhotoEntryId, setRemovingPhotoEntryId] = useState('');
  const project = query.data;
  useEffect(() => {
    if (!progressPhoto) {
      setProgressPhotoPreview('');
      return;
    }
    const preview = URL.createObjectURL(progressPhoto);
    setProgressPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [progressPhoto]);
  const [editProgressSettings, setEditProgressSettings] = useState<ProgressSettingsDraft>(defaultProgressSettings);
  const [showEditProgressError, setShowEditProgressError] = useState(false);
  const [editYarns, setEditYarns] = useState<YarnDraft[]>([]);
  const [editYarnsError, setEditYarnsError] = useState('');
  const [progressAmount, setProgressAmount] = useState<ProgressAmountDraft>({ percent: '0', value: '', done: [] });
  const [progressAmountError, setProgressAmountError] = useState('');
  const editForm = useForm<ProjectFormValues>({
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', designerWebsite: '', designerPageTitle: '', tools: '', hookSize: '', hasSecondHook: false, secondHookSize: '', ...emptyNeedleValues, startedAt: '', startedAtPrecision: 'day', targetDate: '', targetDatePrecision: 'day', completedAt: '', completedAtPrecision: 'day' },
  });
  useEffect(() => {
    if (!project) return;
    editForm.reset({
      title: project.title, craft: project.craft, status: project.status,
      description: project.description || '', patternName: project.patternName || '',
      patternDesigner: project.patternDesigner || '',
      designerWebsite: project.designerWebsite || '', designerPageTitle: project.designerPageTitle || '',
      tools: project.tools || '', hookSize: project.hookSize || '',
      hasSecondHook: Boolean(project.secondHookSize), secondHookSize: project.secondHookSize || '',
      ...needleValuesFromProject(project),
      startedAt: dateForProjectForm(project.startedAt, project.startedAtPrecision),
      startedAtPrecision: project.startedAtPrecision,
      targetDate: dateForProjectForm(project.targetDate, project.targetDatePrecision),
      targetDatePrecision: project.targetDatePrecision,
      completedAt: dateForProjectForm(project.completedAt, project.completedAtPrecision),
      completedAtPrecision: project.completedAtPrecision,
    });
    setDesignerMode(project.designerWebsite ? 'website' : 'name');
    setDesignerPreviewMessage('');
    setEditProgressSettings(progressSettingsFromProject(project));
    setShowEditProgressError(false);
    setEditYarns(yarnDraftsFromProject(project.yarns));
    setEditYarnsError('');
  }, [editing, project?.id, project?.completedAt, project?.progressMethod, editForm.reset]);
  const previewEditDesignerTitle = () => {
    const websiteUrl = editForm.getValues('designerWebsite').trim();
    if (!websiteUrl) {
      setDesignerPreviewMessage('Enter a website link first.');
      return;
    }
    setDesignerPreviewMessage('');
    previewTitle.mutate({ data: { websiteUrl } }, {
      onSuccess: (result) => {
        if (editForm.getValues('designerWebsite').trim() !== websiteUrl) return;
        editForm.setValue('designerWebsite', result.websiteUrl, { shouldDirty: true });
        editForm.setValue('designerPageTitle', result.pageTitle || '', { shouldDirty: true });
        editForm.setValue('patternDesigner', result.designerName, { shouldDirty: true });
        if (!result.pageTitle) setDesignerPreviewMessage('No page title was found. You can still save the link.');
      },
      onError: () => setDesignerPreviewMessage('We could not preview that website. Check the link and try again.'),
    });
  };
  const progressForm = useForm<{ notes: string }>({ defaultValues: { notes: '' } });
  const latestProgressValue = project?.progress.reduce<{ createdAt: string; progressValue: number | null } | undefined>(
    (latest, entry) => (!latest || entry.createdAt > latest.createdAt ? entry : latest), undefined,
  )?.progressValue;
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetSkeinSuggestionsQueryKey() });
  };
  const saveEdit = editForm.handleSubmit((values) => {
    if (progressSettingsError(editProgressSettings)) {
      setShowEditProgressError(true);
      return;
    }
    const yarnList = yarnsForApi(editYarns);
    setEditYarnsError(typeof yarnList === 'string' ? yarnList : '');
    if (typeof yarnList === 'string') return;
    const payload: UpdateProject = {
      title: values.title.trim(), craft: values.craft, status: values.status,
      description: values.description || null, patternName: values.patternName || null,
      patternDesigner: values.patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? values.designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? values.designerPageTitle.trim() || null : null,
      yarns: yarnList,
      tools: values.tools || null,
      ...hooksForApi(values),
      ...needlesForApi(values),
      startedAt: dateForProjectApi(values.startedAt, values.startedAtPrecision),
      startedAtPrecision: values.startedAtPrecision,
      targetDate: dateForProjectApi(values.targetDate, values.targetDatePrecision),
      targetDatePrecision: values.targetDatePrecision,
      // With no date chosen, the server fills in today when the project is
      // marked finished and clears the date when it's reopened.
      ...(values.status === 'completed' && values.completedAt
        ? {
            completedAt: dateForProjectApi(values.completedAt, values.completedAtPrecision),
            completedAtPrecision: values.completedAtPrecision,
          }
        : {}),
      ...progressSettingsForApi(editProgressSettings),
    };
    update.mutate({ projectId, data: payload }, { onSuccess: () => { invalidate(); setEditing(false); } });
  });
  const submitProgress = progressForm.handleSubmit(async (values) => {
    if (!project) return;
    const amount = progressAmountForApi(project, progressAmount);
    if (typeof amount === 'string') {
      setProgressAmountError(amount);
      return;
    }
    setProgressAmountError('');
    const payload: CreateProgress = { notes: values.notes.trim(), ...amount };
    setProgressPhotoError('');
    if (progressPhoto) {
      const uploaded = await uploadProgressPhoto(projectId, progressPhoto);
      if ('error' in uploaded) {
        setProgressPhotoError(uploaded.error);
        return;
      }
      payload.photoPath = uploaded.photoPath;
    }
    addProgress.mutate({ projectId, data: payload }, {
      onSuccess: trackSuccessfulAction('progress_updated', () => {
        invalidate();
        setShowProgress(false);
        setProgressPhoto(null);
        progressForm.reset({ notes: '' });
      }),
    });
  });
  const addProgress = useAddProgress();
  const deleteProject = () => remove.mutate({ projectId }, {
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
      void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
      setLocation('/projects');
    },
  });
  const deleteEntryPhoto = (entryId: string) => {
    setPhotoRemovalError('');
    setRemovingPhotoEntryId(entryId);
    removeProgressPhoto.mutate({ projectId, entryId }, {
      onSuccess: invalidate,
      onError: () => setPhotoRemovalError('We couldn’t remove that photo. Please try again.'),
      onSettled: () => setRemovingPhotoEntryId(''),
    });
  };
  if (query.isLoading) return <PortalLayout active="projects"><LoadingScreen label="Finding this project…"/></PortalLayout>;
  if (query.isError || !project) return <PortalLayout active="projects"><QueryProblem retry={() => query.refetch()} message="We couldn't find this project."/></PortalLayout>;
  const craftLabel = project.craft === 'knitting' ? 'Knitting' : 'Crochet';
  return <PortalLayout active="projects">
    <Link href="/projects" className="back-link" data-testid="link-back-projects"><ArrowLeft size={16}/> Back to projects</Link>
     <div className="detail-heading"><div><h1 className="serif">{project.title}</h1><div className="detail-status"><StatusPill status={project.status}/><span>{craftLabel}</span>{project.startedAt && <span>Started {formatProjectDate(project.startedAt, project.startedAtPrecision)}</span>}</div></div><div className="detail-actions"><StarButton project={project} className="detail-star"/><button className="button button-outline" onClick={() => setEditing(!editing)} data-testid="button-edit-project">{editing ? <X size={16}/> : <Feather size={16}/>} {editing ? 'Close edit' : 'Edit details'}</button><button className="icon-button danger-icon" aria-label="Delete project" title="Delete project" onClick={() => setConfirmDelete(true)} data-testid="button-delete-project"><Trash2 size={17}/></button></div></div>
    <SkeinSuggestions projectId={project.id}/>
    {confirmDelete && <div className="confirm-banner"><div><b>Delete this project?</b><span>This will permanently remove the project and its progress notes.</span></div><button className="button button-quiet" onClick={() => setConfirmDelete(false)} data-testid="button-cancel-delete">Cancel</button><button className="button button-danger" onClick={deleteProject} disabled={remove.isPending} data-testid="button-confirm-delete">{remove.isPending ? 'Removing…' : 'Delete project'}</button></div>}
    {editing && <Form {...editForm}><form className="edit-form loom-card" onSubmit={saveEdit} noValidate><div className="form-intro"><h2 className="serif">Edit details</h2></div><div className="form-grid">
      <div className="field-block field-wide"><label htmlFor="edit-title">Project name <b>*</b></label><input id="edit-title" maxLength={160} aria-invalid={editForm.formState.errors.title ? true : undefined} {...editForm.register('title', { validate: (value) => value.trim() !== '' || 'Your project needs a name.' })} data-testid="input-edit-title"/>{editForm.formState.errors.title && <span className="field-error" role="alert" data-testid="error-edit-title">{editForm.formState.errors.title.message}</span>}</div>
      <div className="field-block"><label htmlFor="edit-craft">Craft</label><select id="edit-craft" {...editForm.register('craft')} data-testid="select-edit-craft"><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select></div>
      <div className="field-block"><label htmlFor="edit-status">Status</label><select id="edit-status" {...editForm.register('status')} data-testid="select-edit-status"><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select></div>
      <ProgressMethodFields value={editProgressSettings} onChange={setEditProgressSettings} prefix="edit" error={showEditProgressError ? progressSettingsError(editProgressSettings) : ''}/>
      <div className="field-block"><label htmlFor="edit-pattern">Pattern name</label><input id="edit-pattern" {...editForm.register('patternName')} data-testid="input-edit-pattern"/></div>
       <DesignerEntry form={editForm} mode={designerMode} onModeChange={(mode) => { setDesignerMode(mode); setDesignerPreviewMessage(''); }} onPreview={previewEditDesignerTitle} onClearPreview={() => setDesignerPreviewMessage('')} isPreviewing={previewTitle.isPending} message={designerPreviewMessage} prefix="edit"/>
      <ProjectYarnsField value={editYarns} onChange={(value) => { setEditYarns(value); setEditYarnsError(''); }} idPrefix="edit" error={editYarnsError}/>
      {project.yarn && <p className="legacy-yarn-note field-wide"><b>Saved yarn note:</b> {project.yarn} <span>This earlier entry is being kept unchanged.</span></p>}
      {editForm.watch('craft') === 'crochet' ? (
        <HookFields form={editForm} idPrefix="edit">{project.tools && <p className="legacy-yarn-note"><b>Saved tools note:</b> {project.tools}<span>This earlier note is being kept unchanged.</span></p>}</HookFields>
      ) : (
        <>
          <NeedleFields form={editForm} idPrefix="edit"/>
          {project.tools && <p className="legacy-yarn-note field-wide"><b>Saved tools note:</b> {project.tools}<span>This earlier note is being kept unchanged.</span></p>}
        </>
      )}
       <ProjectDateField id="edit-started" label="Started on" value={editForm.watch('startedAt')} precision={editForm.watch('startedAtPrecision')} onValueChange={(value) => editForm.setValue('startedAt', value)} onPrecisionChange={(precision) => editForm.setValue('startedAtPrecision', precision)} testId="input-edit-start-date"/>
       <ProjectDateField id="edit-target" label="Target date" value={editForm.watch('targetDate')} precision={editForm.watch('targetDatePrecision')} onValueChange={(value) => editForm.setValue('targetDate', value)} onPrecisionChange={(precision) => editForm.setValue('targetDatePrecision', precision)} testId="input-edit-target-date"/>
       {editForm.watch('status') === 'completed' && <ProjectDateField id="edit-completed" label="Finished on" value={editForm.watch('completedAt')} precision={editForm.watch('completedAtPrecision')} onValueChange={(value) => editForm.setValue('completedAt', value)} onPrecisionChange={(precision) => editForm.setValue('completedAtPrecision', precision)} testId="input-edit-completed-date"/>}
      <div className="field-block field-wide"><label htmlFor="edit-description">Notes</label><textarea id="edit-description" rows={3} {...editForm.register('description')} data-testid="input-edit-description"/></div>
    </div>{update.isError && <p className="mutation-error">We couldn't save those changes. Try again.</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(false)} data-testid="button-cancel-edit">Cancel</button><button className="button button-primary" type="submit" disabled={update.isPending} data-testid="button-update-project">{update.isPending ? 'Saving…' : 'Save changes'} <Check size={15}/></button></div></form></Form>}
    <section className="detail-main-grid">
      <div className="detail-primary">
        <article className="progress-hero loom-card"><div className="progress-hero-copy"><h2 className="serif">Progress</h2>{progressDetail(project, latestProgressValue) && <p className="progress-detail" data-testid="text-progress-detail">{progressDetail(project, latestProgressValue)}</p>}<p>{progressSummary(project.progress)}</p></div><div className="progress-ring" style={{ '--progress': `${project.completionPercent * 3.6}deg` } as CSSProperties}><div><strong>{project.completionPercent}<small>%</small></strong><span>complete</span></div></div></article>
        <ProjectCounter key={project.id} projectId={project.id} initial={project.counter}/>
        <div className="progress-log-heading"><div><h2 className="serif">Progress journal</h2></div><button className="button button-primary button-small" onClick={() => { setShowProgress(!showProgress); setProgressAmount(amountDraftFor(project, latestProgressValue)); setProgressAmountError(''); }} data-testid="button-add-progress">{showProgress ? <X size={15}/> : <Plus size={15}/>} {showProgress ? 'Close note' : 'Add a note'}</button></div>
        {showProgress && <Form {...progressForm}><form className="progress-form loom-card" onSubmit={submitProgress} noValidate><div className="field-block"><label htmlFor="progress-notes">What did you work on?</label><textarea id="progress-notes" rows={3} placeholder="A few rows, a tricky bit figured out, a lovely color change…" {...progressForm.register('notes', { required: 'Add a note about this session.', maxLength: { value: 2000, message: 'Keep your note under 2,000 characters.' } })} data-testid="input-progress-notes"/>{progressForm.formState.errors.notes && <span className="field-error">{progressForm.formState.errors.notes.message}</span>}</div><div className="field-block progress-photo-field"><label htmlFor="progress-photo">Add a progress photo (optional)</label><input id="progress-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setProgressPhoto(event.target.files?.[0] ?? null); setProgressPhotoError(''); }} data-testid="input-progress-photo"/>{progressPhotoPreview && <div className="progress-photo-preview"><img src={progressPhotoPreview} alt="Selected progress photo preview"/><button type="button" className="button button-quiet" onClick={() => setProgressPhoto(null)}>Remove photo</button></div>}</div><div className="progress-form-row"><ProgressAmountField project={project} value={progressAmount} onChange={setProgressAmount}/>{progressAmountError && <span className="field-error" role="alert">{progressAmountError}</span>}</div>{(addProgress.isError || progressPhotoError) && <p className="mutation-error">{progressPhotoError || "Your note didn't stick this time. Please try again."}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setShowProgress(false); setProgressPhoto(null); }} data-testid="button-cancel-progress">Cancel</button><button type="submit" className="button button-primary" disabled={addProgress.isPending} data-testid="button-save-progress">{addProgress.isPending ? 'Saving note…' : 'Save progress'} <ArrowRight size={15}/></button></div></form></Form>}
        {photoRemovalError && <p className="mutation-error" role="alert">{photoRemovalError}</p>}
        {project.progress.length ? <div className="timeline">{[...project.progress].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry, position) => <ProgressEntryCard key={entry.id} project={project} entry={entry} isLatest={position === 0} onChanged={invalidate}>{entry.photoPath && <><img className="timeline-photo" src={`/api/projects/${projectId}/progress/${entry.id}/photo`} alt={`Progress photo for ${project.title}`} loading="lazy"/><button type="button" className="button button-quiet button-remove-progress-photo" onClick={() => deleteEntryPhoto(entry.id)} disabled={removingPhotoEntryId === entry.id} data-testid={`button-remove-progress-photo-${entry.id}`}>{removingPhotoEntryId === entry.id ? 'Removing photo…' : 'Remove photo'} <X size={14}/></button></>}</ProgressEntryCard>)}</div> : <div className="journal-empty"><h3>No notes yet</h3><p>Add a note each time you work on this project.</p><button className="button button-outline" onClick={() => { setShowProgress(true); setProgressAmount(amountDraftFor(project, latestProgressValue)); setProgressAmountError(''); }} data-testid="button-first-progress">Add your first note <ArrowRight size={15}/></button></div>}
      </div>
      <aside className="detail-aside">
        <div className="aside-card loom-card"><h3 className="serif">Details</h3><dl className="detail-list">
          <div><dt>Pattern</dt><dd>{project.patternName || 'Not added yet'}</dd></div>
          <div><dt>Designer</dt><dd>{project.designerWebsite ? <a href={project.designerWebsite} target="_blank" rel="noopener noreferrer" data-testid="link-designer-website">{designerWebsiteLabel(project.designerWebsite, project.designerPageTitle, project.patternDesigner)}</a> : project.patternDesigner || 'Not added yet'}</dd></div>
          <div><dt>{project.yarns.length > 1 ? 'Yarns' : 'Yarn'}</dt><dd><ProjectYarnList project={project}/></dd></div>
          {project.yarn && project.yarns.length > 0 && <div><dt>Previous yarn note</dt><dd>{project.yarn}</dd></div>}
          {project.craft === 'crochet'
            ? <div><dt>Hook size</dt><dd>{project.hookSize || 'Not added yet'}</dd></div>
            : <div><dt>Needle</dt><dd data-testid="text-needle">{describeNeedle(project.needleSize, project.needleType, project.needleCableLength) || 'Not added yet'}</dd></div>}
          {project.craft === 'crochet' && project.secondHookSize && <div><dt>Second hook</dt><dd data-testid="text-second-hook">{project.secondHookSize}</dd></div>}
          {project.craft === 'knitting' && describeNeedle(project.secondNeedleSize, project.secondNeedleType, project.secondNeedleCableLength) && <div><dt>Second needle</dt><dd data-testid="text-second-needle">{describeNeedle(project.secondNeedleSize, project.secondNeedleType, project.secondNeedleCableLength)}</dd></div>}
          {project.tools && <div><dt>Saved tools note</dt><dd>{project.tools}</dd></div>}
          <div><dt>Target date</dt><dd>{formatProjectDate(project.targetDate, project.targetDatePrecision) || 'No date in mind'}</dd></div>
          {project.completedAt && <div><dt>Finished on</dt><dd data-testid="text-completed-date">{formatProjectDate(project.completedAt, project.completedAtPrecision)}</dd></div>}
        </dl>{project.description && <div className="personal-note"><span>Notes</span><p>{project.description}</p></div>}<button className="aside-edit" onClick={() => setEditing(!editing)} data-testid="button-edit-details"><Feather size={14}/> Edit details</button></div>
      </aside>
    </section>
  </PortalLayout>;
}

function stashPhotoUrl(yarn: Pick<StashYarn, 'id' | 'updatedAt'>): string {
  return `/api/yarn-stash/${yarn.id}/photo?v=${encodeURIComponent(String(yarn.updatedAt))}`;
}

function yarnName(yarn: Pick<StashYarn, 'brand' | 'subBrand'>): string {
  return [yarn.brand, yarn.subBrand].filter(Boolean).join(' ');
}

function skeinsLabel(yarn: Pick<StashYarn, 'skeinsPurchased' | 'skeinsLeft'>): string {
  if (yarn.skeinsPurchased === null) return '';
  const left = yarn.skeinsLeft ?? yarn.skeinsPurchased;
  return `${left} of ${yarn.skeinsPurchased} ${yarn.skeinsPurchased === 1 ? 'skein' : 'skeins'} left`;
}

function StashYarnCard({ yarn }: { yarn: StashYarn }) {
  return <Link href={`/stash/${yarn.id}`} className="stash-card loom-card lift" data-testid={`card-stash-yarn-${yarn.id}`}>
    <span className={`stash-photo${yarn.photoPath ? '' : ' needs-photo'}`}>{yarn.photoPath ? <img src={stashPhotoUrl(yarn)} alt={`${yarnName(yarn)}${yarn.color ? ` in ${yarn.color}` : ''}`} loading="lazy"/> : <span className="needs-photo-mark"><Camera size={20}/>Needs a photo</span>}<ColorDot color={yarn.generalColor} className="stash-photo-dot"/></span>
    <span className="stash-card-body">
      <h3>{yarnName(yarn)}</h3>
      {yarn.color && <p>{yarn.color}</p>}
      <span className="stash-card-meta">{[weightLabel(yarn.weight), yarn.blend.map((part) => `${part.percent}% ${part.fiber}`).join(', ')].filter(Boolean).join(' · ')}</span>
      {skeinsLabel(yarn) && <span className="stash-card-skeins">{skeinsLabel(yarn)}</span>}
    </span>
  </Link>;
}

function StashPage() {
  const [search, setSearch] = useState('');
  const [weight, setWeight] = useState('');
  const [color, setColor] = useState('');
  const [sort, setSort] = useSavedSort('mwedi:stash-sort', stashSorts);
  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(weight ? { weight: weight as YarnWeight } : {}),
    ...(color ? { generalColor: color as GeneralColor } : {}),
  };
  const clearFilters = () => { setSearch(''); setWeight(''); setColor(''); };
  const query = useGetStashYarns(params, { query: { queryKey: getGetStashYarnsQueryKey(params) } });
  const filtered = Boolean(search || weight || color);
  return <PortalLayout active="stash">
    <PageHeading title="Yarn stash" action={<Link href="/stash/new" className="button button-primary" data-testid="link-add-yarn"><Plus size={17}/> Add yarn</Link>}/>
    <SkeinSuggestions/>
    <div className="catalog-tools">
      <label className="search-box"><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by brand, color or fiber…" aria-label="Search your stash" data-testid="input-search-stash"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15}/></button>}</label>
      <label className="select-wrap"><Filter size={15}/><select aria-label="Filter by weight" value={weight} onChange={(event) => setWeight(event.target.value)} data-testid="select-weight-filter"><option value="">Every weight</option>{yarnWeights.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      <label className="select-wrap">{color ? <ColorDot color={color as GeneralColor}/> : <Palette size={15}/>}<select aria-label="Filter by color" value={color} onChange={(event) => setColor(event.target.value)} data-testid="select-color-filter"><option value="">Every color</option>{generalColors.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      <label className="select-wrap"><ArrowUpDown size={15}/><select aria-label="Sort your stash" value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} data-testid="select-stash-sort">{stashSorts.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      {filtered && <button className="clear-filters" onClick={clearFilters} data-testid="button-clear-stash-filters">Clear filters</button>}
    </div>
    <div className="catalog-result-caption">{query.data ? <><b>{query.data.length}</b> {query.data.length === 1 ? 'yarn' : 'yarns'}</> : null}</div>
    {query.isLoading ? <div className="stash-grid">{[0, 1, 2, 3].map((item) => <div className="card-skeleton" key={item}/>)}</div>
      : query.isError ? <QueryProblem retry={() => query.refetch()}/>
      : query.data?.length ? <div className="stash-grid">{sortStash(query.data, sort).map((yarn) => <StashYarnCard key={yarn.id} yarn={yarn}/>)}</div>
      : filtered ? <div className="no-results"><Search size={23}/><h3>No yarn matches</h3><p>Try a different search or clear a filter.</p><button className="button button-outline" onClick={clearFilters}>Reset filters</button></div>
      : <div className="empty-projects"><h3>No yarn yet</h3><p>Add your first yarn to start your stash.</p><Link href="/stash/new" className="button button-primary" data-testid="link-add-first-yarn"><Plus size={16}/> Add yarn</Link></div>}
  </PortalLayout>;
}

type StashDraft = {
  brand: string; subBrand: string; color: string; generalColor: GeneralColor | null; weight: YarnWeight | null;
  blend: BlendDraft; brandLink: string; skeinsPurchased: string; skeinsLeft: string;
};

const emptyStashDraft: StashDraft = { brand: '', subBrand: '', color: '', generalColor: null, weight: null, blend: [], brandLink: '', skeinsPurchased: '', skeinsLeft: '' };

function draftFromYarn(yarn: StashYarn): StashDraft {
  return {
    brand: yarn.brand, subBrand: yarn.subBrand ?? '', color: yarn.color ?? '', generalColor: yarn.generalColor, weight: yarn.weight,
    blend: yarn.blend.map((part) => ({ fiber: part.fiber, percent: String(part.percent) })), brandLink: yarn.brandLink ?? '',
    skeinsPurchased: yarn.skeinsPurchased === null ? '' : String(yarn.skeinsPurchased),
    skeinsLeft: yarn.skeinsLeft === null ? '' : String(yarn.skeinsLeft),
  };
}

function skeinsForApi(value: string): number | null | 'invalid' {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 && number <= 999 && Number.isInteger(number * 2) ? number : 'invalid';
}

function StashYarnFormPage({ yarnId }: { yarnId?: string }) {
  const existing = useGetStashYarn(yarnId ?? '', { query: { enabled: Boolean(yarnId), queryKey: getGetStashYarnQueryKey(yarnId ?? '') } });
  if (yarnId && existing.isLoading) return <PortalLayout active="stash"><LoadingScreen label="Finding this yarn…"/></PortalLayout>;
  if (yarnId && (existing.isError || !existing.data)) return <PortalLayout active="stash"><QueryProblem retry={() => existing.refetch()} message="We couldn’t find this yarn."/></PortalLayout>;
  return <StashYarnForm yarn={existing.data} key={existing.data?.id ?? 'new'}/>;
}

function StashYarnForm({ yarn }: { yarn?: StashYarn }) {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateStashYarn();
  const update = useUpdateStashYarn();
  const remove = useDeleteStashYarn();
  const [draft, setDraft] = useState<StashDraft>(() => yarn ? draftFromYarn(yarn) : emptyStashDraft);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'brand' | 'photo' | 'blend' | 'link' | 'skeins' | 'save', string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reviewing, setReviewing] = useState<CatalogField | null>(null);
  const reviews = useGetStashYarnReviews(yarn?.id ?? '', { query: { enabled: Boolean(yarn), queryKey: getGetStashYarnReviewsQueryKey(yarn?.id ?? '') } });
  const errorFor: Partial<Record<keyof StashDraft, keyof typeof errors>> = { brand: 'brand', blend: 'blend', brandLink: 'link', skeinsPurchased: 'skeins', skeinsLeft: 'skeins' };
  const set = (change: Partial<StashDraft>) => {
    setDraft((current) => ({ ...current, ...change }));
    const cleared = Object.keys(change).map((key) => errorFor[key as keyof StashDraft]).filter(Boolean);
    if (cleared.length) setErrors((current) => Object.fromEntries(Object.entries(current).filter(([key]) => !cleared.includes(key as keyof typeof errors))));
  };

  useEffect(() => {
    if (!photo) { setPhotoPreview(''); return; }
    const preview = URL.createObjectURL(photo);
    setPhotoPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [photo]);

  const catalogParams = {
    brand: useSettledValue(draft.brand.trim()),
    subBrand: useSettledValue(draft.subBrand.trim()),
    color: useSettledValue(draft.color.trim()),
  };
  const catalog = useGetYarnCatalog(catalogParams, { query: { queryKey: getGetYarnCatalogQueryKey(catalogParams), placeholderData: (previous) => previous } });
  const fibers = catalog.data?.fibers ?? [];

  // Picking a sub brand or color the catalog already knows fills in what the
  // first maker saved, without overwriting anything typed here.
  useEffect(() => {
    const line = catalog.data?.subBrands.find((item) => item.name === draft.subBrand);
    if (!line) return;
    setDraft((current) => ({
      ...current,
      blend: current.blend.length ? current.blend : line.blend.map((part) => ({ fiber: part.fiber, percent: String(part.percent) })),
      brandLink: current.brandLink || line.link || '',
    }));
  }, [catalog.data?.subBrands, draft.subBrand]);
  useEffect(() => {
    const color = catalog.data?.colors.find((item) => item.name === draft.color);
    if (color?.generalColor) setDraft((current) => current.generalColor ? current : { ...current, generalColor: color.generalColor });
  }, [catalog.data?.colors, draft.color]);

  const done = () => {
    void client.invalidateQueries({ queryKey: getGetStashYarnsQueryKey() });
    if (yarn) void client.invalidateQueries({ queryKey: getGetStashYarnQueryKey(yarn.id) });
    setLocation('/stash');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!draft.brand.trim()) nextErrors.brand = 'Enter the yarn’s brand.';
    if (!photo && !yarn?.photoPath) nextErrors.photo = 'Add a photo of this yarn.';
    if (photo && photo.size > 10 * 1024 * 1024) nextErrors.photo = 'Choose a photo smaller than 10 MB.';
    if (photo && !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) nextErrors.photo = 'Choose a JPEG, PNG, or WebP photo.';
    const blend = blendForApi(draft.blend);
    if (typeof blend === 'string') nextErrors.blend = blend;
    const brandLink = draft.brandLink.trim();
    if (brandLink && !isHttpWebsiteUrl(brandLink)) nextErrors.link = 'Enter a link starting with http:// or https://.';
    const skeinsPurchased = skeinsForApi(draft.skeinsPurchased);
    const skeinsLeft = skeinsForApi(draft.skeinsLeft);
    if (skeinsPurchased === 'invalid' || skeinsLeft === 'invalid') nextErrors.skeins = 'Enter skeins in whole or half skeins, like 3 or 2.5.';
    else if (skeinsLeft !== null && skeinsPurchased !== null && skeinsLeft > skeinsPurchased) nextErrors.skeins = 'Skeins left can’t be more than skeins purchased.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || typeof blend === 'string' || skeinsPurchased === 'invalid' || skeinsLeft === 'invalid') return;

    setSaving(true);
    try {
      let photoPath = yarn?.photoPath;
      if (photo) {
        const contentType = photo.type as 'image/jpeg' | 'image/png' | 'image/webp';
        const upload = await requestStashPhotoUpload({ name: photo.name || 'yarn-photo', size: photo.size, contentType });
        const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: photo });
        if (!uploaded.ok) throw new Error('The photo upload did not finish.');
        photoPath = upload.photoPath;
      }
      const data = {
        brand: draft.brand.trim(), subBrand: draft.subBrand.trim() || null, color: draft.color.trim() || null,
        generalColor: draft.generalColor, weight: draft.weight, blend, brandLink: brandLink || null,
        photoPath: photoPath!, skeinsPurchased, skeinsLeft,
      };
      const options = {
        onSuccess: done,
        onError: (error: unknown) => setErrors({ save: (error as { data?: { error?: string } })?.data?.error ?? 'We couldn’t save this yarn just now. Please try again.' }),
        onSettled: () => setSaving(false),
      };
      if (yarn) update.mutate({ yarnId: yarn.id, data }, options);
      else create.mutate({ data }, options);
    } catch {
      setErrors({ photo: 'We couldn’t upload that photo. Please try again.' });
      setSaving(false);
    }
  };

  const deleteYarn = () => yarn && remove.mutate({ yarnId: yarn.id }, { onSuccess: done });
  const photoShown = photoPreview || (yarn?.photoPath ? stashPhotoUrl(yarn) : '');
  // Only names the catalog saved can be reviewed, so the button appears once
  // a yarn is in the stash.
  const reviewButton = (field: CatalogField) => yarn && (field === 'brand' || (field === 'sub_brand' ? yarn.subBrand : yarn.color))
    ? <NameReviewButton field={field} open={reviewing === field} onToggle={() => setReviewing(reviewing === field ? null : field)}/>
    : null;
  const reviewForm = (field: CatalogField, currentName: string | null) => yarn && reviewing === field && currentName
    ? <NameReviewForm yarnId={yarn.id} field={field} currentName={currentName} onDone={() => setReviewing(null)}/>
    : null;

  return <PortalLayout active="stash">
    <Link href="/stash" className="back-link" data-testid="link-back-stash"><ArrowLeft size={16}/> Back to stash</Link>
    <PageHeading title={yarn ? yarnName(yarn) : 'Add yarn'} action={yarn ? <button className="icon-button danger-icon" aria-label="Delete yarn" title="Delete yarn" onClick={() => setConfirmDelete(true)} data-testid="button-delete-yarn"><Trash2 size={17}/></button> : undefined}/>
    {confirmDelete && <div className="confirm-banner"><div><b>Remove this yarn from your stash?</b><span>Its photo will be deleted too.</span></div><button className="button button-quiet" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="button button-danger" onClick={deleteYarn} disabled={remove.isPending} data-testid="button-confirm-delete-yarn">{remove.isPending ? 'Removing…' : 'Remove yarn'}</button></div>}
    <form className="project-form loom-card" onSubmit={save} noValidate>
      <div className="stash-form-top">
        <div className="field-block stash-photo-field">
          <label htmlFor="stash-photo">Photo <b>*</b></label>
          <label className={`stash-photo-picker${photoShown ? ' has-photo' : ''}`} htmlFor="stash-photo">
            {photoShown ? <img src={photoShown} alt="Yarn photo"/> : <span><Camera size={22}/>Add a photo</span>}
            <ColorDot color={draft.generalColor} className="stash-photo-dot"/>
          </label>
          <input id="stash-photo" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setPhoto(event.target.files?.[0] ?? null); setErrors(({ photo: _photo, ...rest }) => rest); }} data-testid="input-stash-photo"/>
          {photoShown && <label htmlFor="stash-photo" className="stash-photo-change">Change photo</label>}
          {errors.photo && <span className="field-error">{errors.photo}</span>}
        </div>
        <div className="stash-names">
          <div className="field-block"><span className="label-row"><label htmlFor="stash-brand">Brand <b>*</b></label>{reviewButton('brand')}</span>{reviewForm('brand', yarn?.brand ?? null)}<input id="stash-brand" list="stash-brand-options" maxLength={80} placeholder="e.g. Lion Brand" value={draft.brand} onChange={(event) => set({ brand: event.target.value })} autoComplete="off" data-testid="input-stash-brand"/><datalist id="stash-brand-options">{catalog.data?.brands.map((name) => <option key={name} value={name}/>)}</datalist><DidYouMean suggestion={catalog.data?.suggestions.brand} typed={draft.brand} onAccept={(brand) => set({ brand })} testId="button-did-you-mean-brand"/>{errors.brand && <span className="field-error">{errors.brand}</span>}</div>
          <div className="field-block"><span className="label-row"><label htmlFor="stash-sub-brand">Sub brand</label>{reviewButton('sub_brand')}</span>{reviewForm('sub_brand', yarn?.subBrand ?? null)}<input id="stash-sub-brand" list="stash-sub-brand-options" maxLength={80} placeholder="e.g. Wool-Ease" value={draft.subBrand} onChange={(event) => set({ subBrand: event.target.value })} autoComplete="off" data-testid="input-stash-sub-brand"/><datalist id="stash-sub-brand-options">{catalog.data?.subBrands.map((line) => <option key={line.name} value={line.name}/>)}</datalist><DidYouMean suggestion={catalog.data?.suggestions.subBrand} typed={draft.subBrand} onAccept={(subBrand) => set({ subBrand })} testId="button-did-you-mean-sub-brand"/></div>
          <div className="field-block"><span className="label-row"><label htmlFor="stash-color">Color</label>{reviewButton('color')}</span>{reviewForm('color', yarn?.color ?? null)}<input id="stash-color" list="stash-color-options" maxLength={80} placeholder="e.g. Fisherman" value={draft.color} onChange={(event) => set({ color: event.target.value })} autoComplete="off" data-testid="input-stash-color"/><datalist id="stash-color-options">{catalog.data?.colors.map((item) => <option key={item.name} value={item.name}/>)}</datalist><DidYouMean suggestion={catalog.data?.suggestions.color} typed={draft.color} onAccept={(color) => set({ color })} testId="button-did-you-mean-color"/></div>
        </div>
      </div>
      <div className="form-grid stash-form-grid">
        <GeneralColorPicker value={draft.generalColor} onChange={(generalColor) => set({ generalColor })}/>
        <WeightWheelField value={draft.weight} onChange={(weight) => set({ weight })}/>
        <div className="field-block"><label htmlFor="stash-link">Brand page link</label><input id="stash-link" type="url" placeholder="https://" value={draft.brandLink} onChange={(event) => set({ brandLink: event.target.value })} data-testid="input-stash-link"/>{errors.link && <span className="field-error">{errors.link}</span>}</div>
        <BlendFields value={draft.blend} onChange={(blend) => set({ blend })} fibers={fibers} error={errors.blend ?? ''}/>
        <div className="field-block"><label htmlFor="stash-skeins-purchased">Skeins purchased</label><input id="stash-skeins-purchased" inputMode="decimal" placeholder="e.g. 4" value={draft.skeinsPurchased} onChange={(event) => set({ skeinsPurchased: event.target.value })} data-testid="input-skeins-purchased"/></div>
        <div className="field-block"><label htmlFor="stash-skeins-left">Skeins left</label><input id="stash-skeins-left" inputMode="decimal" placeholder={draft.skeinsPurchased || 'Same as purchased'} value={draft.skeinsLeft} onChange={(event) => set({ skeinsLeft: event.target.value })} data-testid="input-skeins-left"/></div>
        {errors.skeins && <span className="field-error field-wide">{errors.skeins}</span>}
      </div>
      <NameReviewList reviews={reviews.data ?? []}/>
      {errors.save && <p className="mutation-error" role="alert">{errors.save}</p>}
      <div className="form-actions"><Link href="/stash" className="button button-quiet">Cancel</Link><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-yarn">{saving ? 'Saving…' : yarn ? 'Save changes' : 'Add to stash'}{!saving && <ArrowRight size={16}/>}</button></div>
    </form>
  </PortalLayout>;
}

function FabricCard({ fabric }: { fabric: StashFabric }) {
  return <Link href={`/sewing/fabric/${fabric.id}`} className="fabric-card lift" data-testid={`card-fabric-${fabric.id}`}>
    <span className="fabric-swatch"><img src={fabricPhotoUrl(fabric, 0)} alt={`${fabricName(fabric)} print`} loading="lazy"/><ColorDot color={fabric.generalColor} noun="fabric" className="stash-photo-dot"/></span>
    <span className="fabric-card-body">
      <h3>{fabricName(fabric)}</h3>
      <span className="fabric-card-meta">{[labelFor(fabricConstructions, fabric.construction), fabric.brand].filter(Boolean).join(' · ')}</span>
      {fabricSize(fabric) && <span className="fabric-card-size">{fabricSize(fabric)}</span>}
    </span>
  </Link>;
}

function FabricStashPage() {
  const [search, setSearch] = useState('');
  const [fabricType, setFabricType] = useState('');
  const [print, setPrint] = useState('');
  const [color, setColor] = useState('');
  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(fabricType ? { fabricType: fabricType as FabricType } : {}),
    ...(print ? { print: print as FabricPrint } : {}),
    ...(color ? { generalColor: color as GeneralColor } : {}),
  };
  const clearFilters = () => { setSearch(''); setFabricType(''); setPrint(''); setColor(''); };
  const query = useGetStashFabrics(params, { query: { queryKey: getGetStashFabricsQueryKey(params) } });
  const filtered = Boolean(search || fabricType || print || color);
  return <PortalLayout active="fabric">
    <PageHeading title="Fabric stash" action={<Link href="/sewing/fabric/new" className="button button-primary" data-testid="link-add-fabric"><Plus size={17}/> Add fabric</Link>}/>
    <div className="catalog-tools">
      <label className="search-box"><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by type, brand or notes…" aria-label="Search your fabric" data-testid="input-search-fabric"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search"><X size={15}/></button>}</label>
      <label className="select-wrap"><Filter size={15}/><select aria-label="Filter by fabric type" value={fabricType} onChange={(event) => setFabricType(event.target.value)} data-testid="select-fabric-type-filter"><option value="">Every type</option>{fabricTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      <label className="select-wrap"><Sparkles size={15}/><select aria-label="Filter by print" value={print} onChange={(event) => setPrint(event.target.value)} data-testid="select-fabric-print-filter"><option value="">Every print</option>{fabricPrints.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      <label className="select-wrap">{color ? <ColorDot color={color as GeneralColor} noun="fabric"/> : <Palette size={15}/>}<select aria-label="Filter by color" value={color} onChange={(event) => setColor(event.target.value)} data-testid="select-fabric-color-filter"><option value="">Every color</option>{generalColors.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select><ChevronDown size={14}/></label>
      {filtered && <button className="clear-filters" onClick={clearFilters} data-testid="button-clear-fabric-filters">Clear filters</button>}
    </div>
    <div className="catalog-result-caption">{query.data ? <><b>{query.data.length}</b> {query.data.length === 1 ? 'fabric' : 'fabrics'}</> : null}</div>
    {query.isLoading ? <div className="fabric-grid">{[0, 1, 2].map((item) => <div className="card-skeleton" key={item}/>)}</div>
      : query.isError ? <QueryProblem retry={() => query.refetch()}/>
      : query.data?.length ? <div className="fabric-grid">{query.data.map((fabric) => <FabricCard key={fabric.id} fabric={fabric}/>)}</div>
      : filtered ? <div className="no-results"><Search size={23}/><h3>No fabric matches</h3><p>Try a different search or clear a filter.</p><button className="button button-outline" onClick={clearFilters}>Reset filters</button></div>
      : <div className="empty-projects"><h3>No fabric yet</h3><p>Add your first fabric to start your stash.</p><Link href="/sewing/fabric/new" className="button button-primary" data-testid="link-add-first-fabric"><Plus size={16}/> Add fabric</Link></div>}
  </PortalLayout>;
}

// A photo already saved on the fabric, by its place in the list, or a new
// file waiting to upload.
type FabricPhotoSlot = { kind: 'kept'; index: number } | { kind: 'new'; file: File; preview: string };

type FabricDraft = {
  fabricType: FabricType | ''; construction: FabricConstruction | null; print: FabricPrint | ''; generalColor: GeneralColor | null;
  unit: FabricUnit; amount: string; width: string; brand: string; notes: string;
};

function draftFromFabric(fabric?: StashFabric): FabricDraft {
  return {
    fabricType: fabric?.fabricType ?? '', construction: fabric?.construction ?? null, print: fabric?.print ?? '', generalColor: fabric?.generalColor ?? null,
    unit: fabric?.unit ?? 'meters', amount: fabric?.amount === null || !fabric ? '' : String(fabric.amount),
    width: fabric?.width === null || !fabric ? '' : String(fabric.width), brand: fabric?.brand ?? '', notes: fabric?.notes ?? '',
  };
}

function FabricFormPage({ fabricId }: { fabricId?: string }) {
  const existing = useGetStashFabric(fabricId ?? '', { query: { enabled: Boolean(fabricId), queryKey: getGetStashFabricQueryKey(fabricId ?? '') } });
  if (fabricId && existing.isLoading) return <PortalLayout active="fabric"><LoadingScreen label="Finding this fabric…"/></PortalLayout>;
  if (fabricId && (existing.isError || !existing.data)) return <PortalLayout active="fabric"><QueryProblem retry={() => existing.refetch()} message="We couldn’t find this fabric."/></PortalLayout>;
  return <FabricForm fabric={existing.data} key={existing.data?.id ?? 'new'}/>;
}

function FabricForm({ fabric }: { fabric?: StashFabric }) {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateStashFabric();
  const update = useUpdateStashFabric();
  const remove = useDeleteStashFabric();
  const [draft, setDraft] = useState<FabricDraft>(() => draftFromFabric(fabric));
  const [photos, setPhotos] = useState<FabricPhotoSlot[]>(() => Array.from({ length: fabric?.photoCount ?? 0 }, (_, index) => ({ kind: 'kept', index })));
  const [errors, setErrors] = useState<Partial<Record<'photo' | 'type' | 'size' | 'save', string>>>({});
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const set = (change: Partial<FabricDraft>) => setDraft((current) => ({ ...current, ...change }));
  const unit = fabricUnits.find((item) => item.value === draft.unit) ?? fabricUnits[0];

  useEffect(() => () => photos.forEach((slot) => { if (slot.kind === 'new') URL.revokeObjectURL(slot.preview); }), []); // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (files: FileList | null, replace?: number) => {
    const chosen = [...(files ?? [])];
    const bad = chosen.find((file) => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024);
    if (bad) { setErrors((current) => ({ ...current, photo: 'Choose JPEG, PNG, or WebP photos up to 10 MB.' })); return; }
    setErrors(({ photo: _photo, ...rest }) => rest);
    setPhotos((current) => {
      const slots = chosen.map((file): FabricPhotoSlot => ({ kind: 'new', file, preview: URL.createObjectURL(file) }));
      if (replace !== undefined) {
        const next = [...current];
        const old = next[replace];
        if (old?.kind === 'new') URL.revokeObjectURL(old.preview);
        next[replace] = slots[0]!;
        return next;
      }
      return [...current, ...slots].slice(0, maxFabricPhotos);
    });
  };
  const removePhoto = (index: number) => setPhotos((current) => {
    const old = current[index];
    if (old?.kind === 'new') URL.revokeObjectURL(old.preview);
    return current.filter((_, place) => place !== index);
  });
  const photoSrc = (slot: FabricPhotoSlot) => slot.kind === 'new' ? slot.preview : fabric ? fabricPhotoUrl(fabric, slot.index) : '';

  const done = () => {
    void client.invalidateQueries({ queryKey: getGetStashFabricsQueryKey() });
    void client.invalidateQueries({ queryKey: getGetMyCraftsQueryKey() });
    if (fabric) void client.invalidateQueries({ queryKey: getGetStashFabricQueryKey(fabric.id) });
    setLocation('/sewing/fabric');
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!photos.length) nextErrors.photo = 'Add a photo of the print.';
    if (!draft.fabricType) nextErrors.type = 'Choose the fabric type.';
    const amount = sizeForApi(draft.amount);
    const width = sizeForApi(draft.width);
    if (amount === 'invalid' || width === 'invalid') nextErrors.size = 'Enter amounts between 0 and 999, like 2.5.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || !draft.fabricType || amount === 'invalid' || width === 'invalid') return;

    setSaving(true);
    let photoPaths: string[];
    try {
      photoPaths = await Promise.all(photos.map(async (slot) => {
        if (slot.kind === 'kept') return `keep:${slot.index}`;
        const contentType = slot.file.type as 'image/jpeg' | 'image/png' | 'image/webp';
        const upload = await requestFabricPhotoUpload({ name: slot.file.name || 'fabric-photo', size: slot.file.size, contentType });
        const uploaded = await fetch(upload.uploadURL, { method: 'PUT', headers: { 'Content-Type': contentType }, body: slot.file });
        if (!uploaded.ok) throw new Error('The photo upload did not finish.');
        return upload.photoPath;
      }));
    } catch {
      setErrors({ photo: 'We couldn’t upload those photos. Please try again.' });
      setSaving(false);
      return;
    }
    const data = {
      fabricType: draft.fabricType, construction: draft.construction, print: draft.print || null, generalColor: draft.generalColor,
      unit: draft.unit, amount, width, brand: draft.brand.trim() || null, notes: draft.notes.trim() || null, photoPaths,
    };
    const options = {
      onSuccess: done,
      onError: (error: unknown) => setErrors({ save: (error as { data?: { error?: string } })?.data?.error ?? 'We couldn’t save this fabric just now. Please try again.' }),
      onSettled: () => setSaving(false),
    };
    if (fabric) update.mutate({ fabricId: fabric.id, data }, options);
    else create.mutate({ data }, options);
  };

  const deleteFabric = () => fabric && remove.mutate({ fabricId: fabric.id }, { onSuccess: done });
  const [main, ...extras] = photos;

  return <PortalLayout active="fabric">
    <Link href="/sewing/fabric" className="back-link" data-testid="link-back-fabric"><ArrowLeft size={16}/> Back to fabric</Link>
    <PageHeading title={fabric ? fabricName(fabric) : 'Add fabric'} action={fabric ? <button className="icon-button danger-icon" aria-label="Delete fabric" title="Delete fabric" onClick={() => setConfirmDelete(true)} data-testid="button-delete-fabric"><Trash2 size={17}/></button> : undefined}/>
    {confirmDelete && <div className="confirm-banner"><div><b>Remove this fabric from your stash?</b><span>Its photos will be deleted too.</span></div><button className="button button-quiet" onClick={() => setConfirmDelete(false)}>Cancel</button><button className="button button-danger" onClick={deleteFabric} disabled={remove.isPending} data-testid="button-confirm-delete-fabric">{remove.isPending ? 'Removing…' : 'Remove fabric'}</button></div>}
    <form className="project-form loom-card fabric-form" onSubmit={save} noValidate>
      <div className="fabric-photos">
        <div className="field-block">
          <label htmlFor="fabric-photo-main">Print close-up <b>*</b></label>
          <label className={`fabric-photo-main${main ? ' has-photo' : ''}`} htmlFor="fabric-photo-main">
            {main ? <img src={photoSrc(main)} alt="Print close-up"/> : <span><Camera size={24}/>Add a close-up of the print</span>}
          </label>
          <input id="fabric-photo-main" className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { addPhotos(event.target.files, main ? 0 : undefined); event.target.value = ''; }} data-testid="input-fabric-photo-main"/>
          {main && <label htmlFor="fabric-photo-main" className="stash-photo-change">Change photo</label>}
        </div>
        <div className="field-block">
          <label htmlFor="fabric-photo-more">More photos</label>
          <div className="fabric-photo-extras">
            {extras.map((slot, place) => <span key={place} className="fabric-photo-extra"><img src={photoSrc(slot)} alt={`Fabric photo ${place + 2}`}/><button type="button" aria-label={`Remove photo ${place + 2}`} onClick={() => removePhoto(place + 1)} data-testid={`button-remove-fabric-photo-${place + 2}`}><X size={14}/></button></span>)}
            {main && photos.length < maxFabricPhotos && <label className="fabric-photo-extra fabric-photo-add" htmlFor="fabric-photo-more"><Plus size={18}/><span>Add</span></label>}
          </div>
          <input id="fabric-photo-more" className="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={!main || photos.length >= maxFabricPhotos} onChange={(event) => { addPhotos(event.target.files); event.target.value = ''; }} data-testid="input-fabric-photo-more"/>
          <span className="field-hint">Up to three more, like the full piece or the drape.</span>
        </div>
        {errors.photo && <span className="field-error field-wide">{errors.photo}</span>}
      </div>
      <div className="form-grid">
        <div className="field-block"><label htmlFor="fabric-type">Fabric type <b>*</b></label><select id="fabric-type" value={draft.fabricType} onChange={(event) => { set({ fabricType: event.target.value as FabricType }); setErrors(({ type: _type, ...rest }) => rest); }} data-testid="select-fabric-type"><option value="">Choose a type</option>{fabricTypes.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select>{errors.type && <span className="field-error">{errors.type}</span>}</div>
        <div className="field-block"><label id="fabric-construction-label">Woven or knit</label><div className="segmented" role="radiogroup" aria-labelledby="fabric-construction-label">{fabricConstructions.map((item) => <button key={item.value} type="button" role="radio" aria-checked={draft.construction === item.value} className={draft.construction === item.value ? 'selected' : ''} onClick={() => set({ construction: draft.construction === item.value ? null : item.value })} data-testid={`button-construction-${item.value}`}>{item.label}</button>)}</div></div>
        <div className="field-block"><label htmlFor="fabric-print">Print</label><select id="fabric-print" value={draft.print} onChange={(event) => set({ print: event.target.value as FabricPrint | '' })} data-testid="select-fabric-print"><option value="">Choose a print</option>{fabricPrints.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
        <div className="field-block"><label id="fabric-unit-label">Measured in</label><div className="segmented" role="radiogroup" aria-labelledby="fabric-unit-label">{fabricUnits.map((item) => <button key={item.value} type="button" role="radio" aria-checked={draft.unit === item.value} className={draft.unit === item.value ? 'selected' : ''} onClick={() => set({ unit: item.value })} data-testid={`button-unit-${item.value}`}>{item.label}</button>)}</div></div>
        <GeneralColorPicker value={draft.generalColor} onChange={(generalColor) => set({ generalColor })}/>
        <div className="field-block"><label htmlFor="fabric-amount">Amount</label><span className="input-with-unit"><input id="fabric-amount" inputMode="decimal" placeholder="e.g. 2.5" value={draft.amount} onChange={(event) => { set({ amount: event.target.value }); setErrors(({ size: _size, ...rest }) => rest); }} data-testid="input-fabric-amount"/><i>{unit.amount}</i></span></div>
        <div className="field-block"><label htmlFor="fabric-width">Width</label><span className="input-with-unit"><input id="fabric-width" inputMode="decimal" placeholder={draft.unit === 'meters' ? 'e.g. 145' : 'e.g. 58'} value={draft.width} onChange={(event) => { set({ width: event.target.value }); setErrors(({ size: _size, ...rest }) => rest); }} data-testid="input-fabric-width"/><i>{unit.width}</i></span></div>
        {errors.size && <span className="field-error field-wide">{errors.size}</span>}
        <div className="field-block"><label htmlFor="fabric-brand">Brand</label><input id="fabric-brand" maxLength={80} placeholder="Optional" value={draft.brand} onChange={(event) => set({ brand: event.target.value })} data-testid="input-fabric-brand"/></div>
        <div className="field-block field-wide"><label htmlFor="fabric-notes">Notes</label><textarea id="fabric-notes" rows={3} maxLength={1000} placeholder="Where it's from, what it's for…" value={draft.notes} onChange={(event) => set({ notes: event.target.value })} data-testid="input-fabric-notes"/></div>
      </div>
      {errors.save && <p className="mutation-error" role="alert">{errors.save}</p>}
      <div className="form-actions"><Link href="/sewing/fabric" className="button button-quiet">Cancel</Link><button type="submit" className="button button-primary" disabled={saving} data-testid="button-save-fabric">{saving ? 'Saving…' : fabric ? 'Save changes' : 'Add to stash'}{!saving && <ArrowRight size={16}/>}</button></div>
    </form>
  </PortalLayout>;
}

function ReviewCard({ review }: { review: CatalogReview }) {
  const client = useQueryClient();
  const resolve = useResolveCatalogReview();
  const [name, setName] = useState(review.suggestedName);
  const [reviewerNote, setReviewerNote] = useState('');
  const [error, setError] = useState('');
  const finish = (action: 'rename' | 'keep') => resolve.mutate(
    { reviewId: review.id, data: { action, ...(action === 'rename' ? { name: name.trim() } : {}), reviewerNote: reviewerNote.trim() || null } },
    {
      onSuccess: () => void client.invalidateQueries({ queryKey: getGetCatalogReviewsQueryKey() }),
      onError: (failure: unknown) => setError((failure as { data?: { error?: string } })?.data?.error ?? 'We couldn’t save that just now. Please try again.'),
    },
  );
  return <article className="review-card loom-card" data-testid={`card-review-${review.id}`}>
    <div className="review-card-top"><b>{catalogFieldLabels[review.field]}</b><span>{review.requesterName ?? 'A maker'} · {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(review.createdAt))}</span></div>
    <p className="review-names"><span>{review.currentName}</span> → <span>{review.suggestedName}</span></p>
    {review.note && <p className="review-note">{review.note}</p>}
    {review.status === 'open' ? <>
      <div className="field-block"><label htmlFor={`review-name-${review.id}`}>Catalog name</label><input id={`review-name-${review.id}`} maxLength={80} value={name} onChange={(event) => { setName(event.target.value); setError(''); }} data-testid={`input-catalog-name-${review.id}`}/></div>
      <div className="field-block"><label htmlFor={`review-reply-${review.id}`}>Reply to the maker (optional)</label><input id={`review-reply-${review.id}`} maxLength={500} value={reviewerNote} onChange={(event) => setReviewerNote(event.target.value)} data-testid={`input-review-reply-${review.id}`}/></div>
      {error && <span className="field-error">{error}</span>}
      <div className="review-actions"><button type="button" className="button button-outline button-small" disabled={resolve.isPending} onClick={() => finish('keep')} data-testid={`button-keep-name-${review.id}`}>Keep as is</button><button type="button" className="button button-primary button-small" disabled={resolve.isPending || !name.trim()} onClick={() => finish('rename')} data-testid={`button-rename-${review.id}`}>Rename</button></div>
    </> : <p className={`review-status ${review.status}`}>{review.status === 'renamed' ? 'Renamed' : 'Kept as is'}{review.reviewerNote ? ` · ${review.reviewerNote}` : ''}</p>}
  </article>;
}

function ReviewsPage() {
  const access = useGetCatalogReviewAccess({ query: { queryKey: getGetCatalogReviewAccessQueryKey() } });
  const query = useGetCatalogReviews({ query: { queryKey: getGetCatalogReviewsQueryKey(), enabled: Boolean(access.data?.reviewer) } });
  if (access.isLoading) return <PortalLayout active="reviews"><LoadingScreen label="Checking reviews…"/></PortalLayout>;
  if (!access.data?.reviewer) return <Redirect to="/stash"/>;
  const open = query.data?.filter((review) => review.status === 'open') ?? [];
  const done = query.data?.filter((review) => review.status !== 'open') ?? [];
  return <PortalLayout active="reviews">
    <PageHeading title="Name reviews"/>
    {query.isLoading ? <LoadingScreen label="Gathering reviews…"/>
      : query.isError ? <QueryProblem retry={() => query.refetch()}/>
      : <>
        {open.length ? <div className="review-grid">{open.map((review) => <ReviewCard key={review.id} review={review}/>)}</div> : <div className="empty-projects"><h3>No reviews waiting</h3></div>}
        {done.length > 0 && <><div className="form-divider"><span>Resolved</span><i/></div><div className="review-grid">{done.map((review) => <ReviewCard key={review.id} review={review}/>)}</div></>}
      </>}
  </PortalLayout>;
}

function AuthCacheRouter() {
  const [, setLocation] = useLocation();
  return <ClerkProvider
    publishableKey={clerkPubKey}
    proxyUrl={clerkProxyUrl}
    appearance={clerkAppearance}
    signInUrl={`${basePath}/sign-in`}
    signUpUrl={`${basePath}/sign-up`}
    localization={{
      signIn: {
        start: { title: 'Sign in', subtitle: '' },
      },
      signUp: {
        start: { title: 'Sign up', subtitle: '' },
      },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}><TooltipProvider><ClerkCacheInvalidator/>
      <Switch>
        <Route path="/" component={HomeRoute}/>
        <Route path="/about" component={AboutPage}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/dashboard"><PrivateRoute><DashboardPage/></PrivateRoute></Route>
        <Route path="/projects"><PrivateRoute><ProjectsPage/></PrivateRoute></Route>
        <Route path="/projects/new"><PrivateRoute><ProjectFormPage/></PrivateRoute></Route>
        <Route path="/stash"><PrivateRoute><StashPage/></PrivateRoute></Route>
        <Route path="/reviews"><PrivateRoute><ReviewsPage/></PrivateRoute></Route>
        <Route path="/stash/new"><PrivateRoute><StashYarnFormPage/></PrivateRoute></Route>
        <Route path="/stash/:yarnId">{(params) => <PrivateRoute><StashYarnFormPage yarnId={params.yarnId}/></PrivateRoute>}</Route>
        <Route path="/projects/:projectId">{(params) => <PrivateRoute><ProjectDetailPage projectId={params.projectId}/></PrivateRoute>}</Route>
        <Route path="/sewing"><Redirect to="/sewing/fabric"/></Route>
        <Route path="/sewing/fabric"><PrivateRoute craft="sewing"><FabricStashPage/></PrivateRoute></Route>
        <Route path="/sewing/fabric/new"><PrivateRoute craft="sewing"><FabricFormPage/></PrivateRoute></Route>
        <Route path="/sewing/fabric/:fabricId">{(params) => <PrivateRoute craft="sewing"><FabricFormPage fabricId={params.fabricId}/></PrivateRoute>}</Route>
        <Route component={NotFound}/>
      </Switch>
      <Toaster/>
    </TooltipProvider></QueryClientProvider>
  </ClerkProvider>;
}

function App() {
  if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
  return <WouterRouter base={basePath}><ErrorBoundary><AuthCacheRouter/></ErrorBoundary></WouterRouter>;
}

export default App;
