import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useSignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  requestProgressPhotoUpload, useAddProgress, useCreateProject, useDeleteProgressPhoto, useDeleteProject, useGetDashboard,
  usePreviewDesignerWebsiteTitle,
  useGetProject, useGetProjects, useStarProject, useUnstarProject, useUpdateProject,
  getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey,
} from '@workspace/api-client-react';
import { CrochetHookSize } from '@workspace/api-client-react';
import type { CreateProject, CreateProgress, Project, ProjectStatus, UpdateProject } from '@workspace/api-client-react';
import { FormProvider as Form, useForm, type UseFormReturn } from 'react-hook-form';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronDown, ChevronUp, CircleHelp, Feather, Filter, Flower2, Gauge,
  Heart, Layers3, LogOut, Menu, Plus, Search, Sparkles, Star, Trash2,
  TrendingUp, X,
} from 'lucide-react';
import {
  Link, Redirect, Route, Switch, useLocation, Router as WouterRouter,
} from 'wouter';
import { DashboardCharts } from '@/components/dashboard-charts';
import { ErrorBoundary } from '@/components/error-boundary';
import { trackEvent, trackSuccessfulAction } from '@/lib/analytics';
import { Toaster } from '@/components/ui/toaster';
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
    logoImage: 'max-h-10',
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
  return <span className={`brand-mark ${light ? 'brand-mark-light' : ''}`} aria-hidden="true">
    <svg viewBox="0 0 34 34" fill="none"><path d="M7 7.5c7.1 0 7.1 19 14.2 19S28.3 7.5 21.2 7.5 14.1 26.5 7 26.5" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round"/><path d="M7 13.5c7.1 0 7.1 7 14.2 7S28.3 13.5 21.2 13.5 14.1 20.5 7 20.5" stroke="currentColor" strokeWidth="1.4" opacity=".55" strokeLinecap="round"/></svg>
  </span>;
}

function Brand({ light = false }: { light?: boolean }) {
  return <Link href="/" className={`brand-lockup ${light ? 'brand-light' : ''}`} data-testid="link-brand-home">
    <Mark light={light} /><span>Mwedi<span className="brand-soft"> Threads</span></span>
  </Link>;
}

function HomeRoute() {
  const { isLoaded, isSignedIn } = useAuth();
  if (isLoaded && isSignedIn) return <Redirect to="/dashboard" />;
  return <Landing />;
}

function Landing() {
  return <main className="landing paper-grain">
    <nav className="landing-nav">
      <Brand />
      <div className="landing-nav-links"><a href="#how-it-works">A gentler way to keep track</a><Link href="/sign-in" className="nav-signin" data-testid="link-sign-in">Sign in <ArrowRight size={15}/></Link></div>
    </nav>
    <section className="landing-hero">
      <div className="hero-copy appear">
        <div className="eyebrow"><span className="eyebrow-stitch"/>A little home for your making</div>
        <h1>Your hands are busy.<br/><em>Let your mind rest.</em></h1>
        <p className="hero-lede">Keep every cast-on, color choice, and almost-finished sleeve in one lovely place. Mwedi Threads is your personal notebook for making things slowly, and well.</p>
        <div className="hero-actions"><Link href="/sign-up" className="button button-primary" data-testid="link-get-started">Make a free account <ArrowRight size={17}/></Link><a href="#how-it-works" className="text-link">Take a look around <ArrowDownRight size={16}/></a></div>
        <div className="hero-footnote"><span className="avatar-stack"><i>J</i><i>M</i><i>A</i></span><span>A quiet corner for every kind of maker</span></div>
      </div>
      <div className="hero-art appear" aria-label="Illustration of a work in progress">
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
    <section className="landing-ribbon" id="how-it-works"><div><Layers3 size={18}/><span>Every project, gathered</span></div><i/><div><TrendingUp size={18}/><span>Progress you can feel</span></div><i/><div><Heart size={18}/><span>Made for your own rhythm</span></div></section>
    <section className="landing-story">
      <div className="story-side"><span className="eyebrow">THE MAKER'S NOTEBOOK</span><h2>From the first idea<br/>to the final weave-in.</h2><p>No streaks to keep. No pressure to finish. Just a thoughtful record of the things you make and the small steps that got you there.</p><Link href="/sign-up" className="underlined-link">Start your project journal <ArrowRight size={16}/></Link></div>
      <div className="story-cards">
        <article className="story-card story-card-plum"><span className="story-number">01</span><BookOpen size={23}/><h3>Give every project<br/>a proper place.</h3><p>Pattern, yarn, tools, dates — all the details you meant to remember.</p><div className="yarn-spool spool-a"/><div className="yarn-spool spool-b"/></article>
        <article className="story-card story-card-apricot"><span className="story-number">02</span><Gauge size={23}/><h3>Notice how far<br/>you've come.</h3><p>Leave a note after a session. Your progress adds up, quietly.</p><Flower2 className="stitch-motif" size={88} strokeWidth={1}/></article>
      </div>
    </section>
    <footer className="landing-footer"><Brand/><span>Made for makers, wherever the yarn takes you.</span><Link href="/sign-up">Your next project is waiting <ArrowRight size={15}/></Link></footer>
  </main>;
}

function SignInPage() {
  return <div className="auth-screen paper-grain"><div className="auth-ornament"><Brand/><p>A softer place to pick up<br/>where you left off.</p><span className="auth-thread"/></div><div className="auth-panel"><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
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

  return <div className="auth-screen paper-grain"><div className="auth-ornament"><Brand/><p>Make room for all the<br/>things you're dreaming up.</p><span className="auth-thread"/></div><div className="auth-panel"><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
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

function PrivateRoute({ children }: { children: ReactNode }) {
  const { isLoaded, isSignedIn } = useAuth();
  if (!isLoaded) return <LoadingScreen label="Opening your workspace…"/>;
  if (!isSignedIn) return <Redirect to="/"/>;
  return <>{children}</>;
}

function PortalLayout({ children, active }: { children: ReactNode; active: 'dashboard' | 'projects' }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { user } = useUser();
  const { signOut } = useClerk();
  const displayName = user?.firstName || user?.username || 'Maker';
  const initials = displayName.slice(0, 1).toUpperCase();
  return <div className="portal-shell">
    <aside className={`side-rail ${mobileOpen ? 'mobile-open' : ''}`}>
      <div className="rail-brand"><Brand light/><button className="rail-close" type="button" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-close-navigation"><X size={19}/></button></div>
      <nav className="rail-nav">
        <Link href="/dashboard" className={`rail-link ${active === 'dashboard' ? 'selected' : ''}`} data-testid="link-dashboard"><Layers3 size={18}/><span>Overview</span></Link>
        <Link href="/projects" className={`rail-link ${active === 'projects' ? 'selected' : ''}`} data-testid="link-projects"><BookOpen size={18}/><span>My projects</span></Link>
      </nav>
      <div className="rail-bottom"><ProfileMenu initials={initials} displayName={displayName} onSignOut={() => signOut({ redirectUrl: basePath || '/' })}/></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-dismiss-navigation"/>}
    <main className="portal-main">
      <header className="portal-topbar"><button className="menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21}/></button><div className="breadcrumbs"><span>Mwedi Threads</span><i>/</i><b>{active === 'dashboard' ? 'Overview' : 'My projects'}</b></div><div className="topbar-end"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date())}</span><span className="top-avatar">{initials}</span></div></header>
      <div className="portal-content appear">{children}</div>
    </main>
  </div>;
}

function ProfileMenu({ initials, displayName, onSignOut }: { initials: string; displayName: string; onSignOut: () => void }) {
  const [open, setOpen] = useState(false);
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
    {open && <div className="profile-menu-list" role="menu"><button type="button" role="menuitem" onClick={onSignOut} data-testid="button-sign-out"><LogOut size={16}/> Sign out</button></div>}
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

function ProgressBar({ value }: { value: number }) {
  return <div className="progress-track" aria-label={`${value}% complete`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></div>;
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
    <div className="project-card-body"><div className="project-card-meta"><StatusPill status={project.status}/></div><h3>{project.title}</h3><p>{[craftLabel, project.patternName].filter(Boolean).join(' · ')}</p><div className="card-progress"><ProgressBar value={project.completionPercent}/><span>{project.completionPercent}%</span></div><div className="card-foot">{formatYarnDetails(project) && <span>{formatYarnDetails(project)}</span>}{project.updatedAt && <span className="updated-label">Updated {new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(project.updatedAt))}</span>}</div></div>
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
        <div className="stat-card"><span className="stat-label">All projects</span><strong>{data.totalProjects}</strong></div>
        <div className="stat-card"><span className="stat-label">In progress</span><strong>{data.activeProjects}</strong></div>
        <div className="stat-card"><span className="stat-label">Finished</span><strong>{data.completedProjects}</strong></div>
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

function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [craft, setCraft] = useState('');
  const [starredOnly, setStarredOnly] = useState(false);
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
      <label className="search-box"><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project…" aria-label="Search projects" data-testid="input-search-projects"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15}/></button>}</label>
      <label className="select-wrap"><Filter size={15}/><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-status-filter"><option value="">Every status</option><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select><ChevronDown size={14}/></label>
      <label className="select-wrap"><select aria-label="Filter by craft" value={craft} onChange={(event) => setCraft(event.target.value)} data-testid="select-craft-filter"><option value="">Every craft</option><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select><ChevronDown size={14}/></label>
      <button type="button" className={`starred-filter${starredOnly ? ' is-active' : ''}`} aria-pressed={starredOnly} onClick={() => setStarredOnly(!starredOnly)} data-testid="button-starred-filter"><Star size={14} fill={starredOnly ? 'currentColor' : 'none'}/> Starred</button>
      {(search || status || craft || starredOnly) && <button className="clear-filters" onClick={clearFilters} data-testid="button-clear-filters">Clear filters</button>}
    </div>
    <div className="catalog-result-caption">{query.data ? <><b>{query.data.length}</b> {query.data.length === 1 ? 'project' : 'projects'}</> : null}</div>
    {query.isLoading ? <div className="project-card-grid">{[0, 1, 2].map((item) => <div className="card-skeleton" key={item}/>)}</div> : query.isError ? <QueryProblem retry={() => query.refetch()}/> : query.data?.length ? <div className="project-card-grid catalog-grid">{query.data.map((project) => <ProjectCard key={project.id} project={project}/>)}</div> : starredOnly && !search && !status && !craft ? <div className="no-results"><Star size={23}/><h3>No starred projects yet</h3><p>Tap the star on any project to keep your favorites here.</p><button className="button button-outline" onClick={clearFilters} data-testid="button-reset-filters">Show all projects</button></div> : search || status || craft || starredOnly ? <div className="no-results"><Search size={23}/><h3>No projects match</h3><p>Try a different search or clear a filter.</p><button className="button button-outline" onClick={clearFilters} data-testid="button-reset-filters">Reset filters</button></div> : <EmptyProjects/>}
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

function formatYarnDetails(project: Pick<Project, 'yarn' | 'yarnBrand' | 'yarnType' | 'yarnColor'>): string {
  return [project.yarnBrand, project.yarnType, project.yarnColor].filter(Boolean).join(' · ')
    || project.yarn
    || '';
}

function ProjectDateField({
  id,
  label,
  value,
  precision,
  onValueChange,
  onPrecisionChange,
  testId,
}: {
  id: string;
  label: string;
  value: string;
  precision: ProjectDatePrecision;
  onValueChange: (value: string) => void;
  onPrecisionChange: (precision: ProjectDatePrecision) => void;
  testId: string;
}) {
  const changePrecision = (next: ProjectDatePrecision) => {
    if (next === precision) return;
    onValueChange(next === 'month' ? value.slice(0, 7) : '');
    onPrecisionChange(next);
  };
  return <div className="field-block project-date-field">
    <label htmlFor={id}>{label}</label>
    <div className="project-date-controls">
      <select
        aria-label={`${label} format`}
        value={precision}
        onChange={(event) => changePrecision(event.target.value as ProjectDatePrecision)}
        data-testid={`${testId}-precision`}
      >
        <option value="month">MM/YY</option>
        <option value="day">MM/DD/YY</option>
      </select>
      <input
        id={id}
        type={precision === 'month' ? 'month' : 'date'}
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        aria-label={`${label} (${precision === 'month' ? 'month and year' : 'month, day, and year'})`}
        data-testid={testId}
      />
    </div>
    <span className="date-format-hint">{precision === 'month' ? 'Month and year only' : 'Include the day'}</span>
  </div>;
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

  return <div className="designer-entry field-wide">
    <div className="designer-entry-heading"><b>Design</b><span>Use a name or link to their website.</span></div>
    <div className="designer-mode-switch" role="group" aria-label="Designer entry option">
      <button type="button" aria-pressed={mode === 'name'} className={mode === 'name' ? 'selected' : ''} onClick={() => onModeChange('name')} data-testid={`button-${prefix}-designer-name`}>Name</button>
      <button type="button" aria-pressed={mode === 'website'} className={mode === 'website' ? 'selected' : ''} onClick={() => onModeChange('website')} data-testid={`button-${prefix}-designer-website`}>Website link</button>
    </div>
    {mode === 'name' ? (
      <div className="field-block"><label htmlFor={`${prefix}-pattern-designer`}>Designer name</label><input id={`${prefix}-pattern-designer`} placeholder="Who made the pattern?" {...form.register('patternDesigner')} data-testid={prefix === 'create' ? 'input-pattern-designer' : 'input-edit-designer'}/></div>
    ) : (
      <>
        <div className="designer-website-row">
          <div className="field-block"><label htmlFor={`${prefix}-designer-website`}>Website link</label><input id={`${prefix}-designer-website`} type="url" autoCapitalize="none" autoCorrect="off" placeholder="https://example.com" {...websiteRegistration} onChange={(event) => { void websiteRegistration.onChange(event); form.setValue('designerPageTitle', '', { shouldDirty: true }); form.setValue('patternDesigner', '', { shouldDirty: true }); onClearPreview(); }} data-testid={`input-${prefix}-designer-website`}/></div>
          <button type="button" className="button button-outline designer-preview-button" onClick={onPreview} disabled={isPreviewing} data-testid={`button-${prefix}-preview-designer-title`}>{isPreviewing ? 'Previewing…' : 'Preview page title'}</button>
        </div>
        {form.formState.errors.designerWebsite?.message && <p className="field-error" role="alert">{form.formState.errors.designerWebsite.message}</p>}
        <input type="hidden" {...form.register('designerPageTitle')}/>
        {pageTitle && <div className="designer-page-preview" role="status" data-testid="designer-page-title-preview"><span>Page title preview</span><strong>{pageTitle}</strong></div>}
        {message && <p className="designer-preview-message" role="status">{message}</p>}
      </>
    )}
  </div>;
}

type ProjectFormValues = {
  title: string; craft: 'knitting' | 'crochet'; status: ProjectStatus;
  description: string; patternName: string; patternDesigner: string;
  designerWebsite: string; designerPageTitle: string;
  yarnBrand: string; yarnType: string; yarnColor: string;
  tools: string; hookSize: NonNullable<CreateProject['hookSize']> | '';
  startedAt: string; startedAtPrecision: ProjectDatePrecision;
  targetDate: string; targetDatePrecision: ProjectDatePrecision;
  completedAt: string; completedAtPrecision: ProjectDatePrecision;
};

const crochetHookSizes = Object.values(CrochetHookSize) as NonNullable<CreateProject['hookSize']>[];

function ProjectFormPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateProject();
  const previewTitle = usePreviewDesignerWebsiteTitle();
  const [designerMode, setDesignerMode] = useState<DesignerMode>('name');
  const [designerPreviewMessage, setDesignerPreviewMessage] = useState('');
  const form = useForm<ProjectFormValues>({
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', designerWebsite: '', designerPageTitle: '', yarnBrand: '', yarnType: '', yarnColor: '', tools: '', hookSize: '', startedAt: '', startedAtPrecision: 'day', targetDate: '', targetDatePrecision: 'day', completedAt: '', completedAtPrecision: 'day' },
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
    const payload: CreateProject = {
      title: values.title.trim(), craft: values.craft, status: values.status,
      description: values.description || null, patternName: values.patternName || null,
      patternDesigner: values.patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? values.designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? values.designerPageTitle.trim() || null : null,
      yarn: null,
      yarnBrand: values.yarnBrand.trim() || null,
      yarnType: values.yarnType.trim() || null,
      yarnColor: values.yarnColor.trim() || null,
      tools: values.tools || null,
      hookSize: values.craft === 'crochet' ? values.hookSize || null : null,
      startedAt: dateForProjectApi(values.startedAt, values.startedAtPrecision),
      startedAtPrecision: values.startedAtPrecision,
      targetDate: dateForProjectApi(values.targetDate, values.targetDatePrecision),
      targetDatePrecision: values.targetDatePrecision,
    };
    create.mutate({ data: payload }, {
      onSuccess: trackSuccessfulAction('project_created', (project: Project) => {
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
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
      </div>
      <div className="form-divider"><span>Pattern and materials</span><i/></div>
      <div className="form-grid">
        <div className="field-block"><label htmlFor="pattern-name">Pattern name</label><input id="pattern-name" placeholder="Pattern or source" {...form.register('patternName')} data-testid="input-pattern-name"/></div>
        <DesignerEntry form={form} mode={designerMode} onModeChange={(mode) => { setDesignerMode(mode); setDesignerPreviewMessage(''); }} onPreview={previewDesignerTitle} onClearPreview={() => setDesignerPreviewMessage('')} isPreviewing={previewTitle.isPending} message={designerPreviewMessage} prefix="create"/>
        <div className="yarn-group field-wide">
          <div className="yarn-group-heading"><b>Yarn</b></div>
          <div className="yarn-trifold">
            <div className="field-block"><label htmlFor="project-yarn-brand">Brand</label><input id="project-yarn-brand" placeholder="e.g. Cascade" {...form.register('yarnBrand')} data-testid="input-yarn-brand"/></div>
            <div className="field-block"><label htmlFor="project-yarn-type">Type</label><input id="project-yarn-type" placeholder="e.g. Merino DK" {...form.register('yarnType')} data-testid="input-yarn-type"/></div>
            <div className="field-block"><label htmlFor="project-yarn-color">Color</label><input id="project-yarn-color" placeholder="e.g. Oatmeal" {...form.register('yarnColor')} data-testid="input-yarn-color"/></div>
          </div>
        </div>
        {form.watch('craft') === 'crochet' ? (
          <div className="field-block"><label htmlFor="project-hook-size">Hook size</label><select id="project-hook-size" {...form.register('hookSize')} data-testid="select-crochet-hook-size"><option value="">Choose a hook size</option>{crochetHookSizes.map((hookSize) => <option key={hookSize} value={hookSize}>{hookSize}</option>)}</select></div>
        ) : (
          <div className="field-block"><label htmlFor="project-tools">Tools</label><input id="project-tools" placeholder="Needle size or other tools…" {...form.register('tools')} data-testid="input-project-tools"/></div>
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
  const editForm = useForm<ProjectFormValues>({
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', designerWebsite: '', designerPageTitle: '', yarnBrand: '', yarnType: '', yarnColor: '', tools: '', hookSize: '', startedAt: '', startedAtPrecision: 'day', targetDate: '', targetDatePrecision: 'day', completedAt: '', completedAtPrecision: 'day' },
  });
  useEffect(() => {
    if (!project) return;
    editForm.reset({
      title: project.title, craft: project.craft, status: project.status,
      description: project.description || '', patternName: project.patternName || '',
      patternDesigner: project.patternDesigner || '',
      designerWebsite: project.designerWebsite || '', designerPageTitle: project.designerPageTitle || '',
      yarnBrand: project.yarnBrand || '', yarnType: project.yarnType || '', yarnColor: project.yarnColor || '',
      tools: project.tools || '', hookSize: project.hookSize || '',
      startedAt: dateForProjectForm(project.startedAt, project.startedAtPrecision),
      startedAtPrecision: project.startedAtPrecision,
      targetDate: dateForProjectForm(project.targetDate, project.targetDatePrecision),
      targetDatePrecision: project.targetDatePrecision,
      completedAt: dateForProjectForm(project.completedAt, project.completedAtPrecision),
      completedAtPrecision: project.completedAtPrecision,
    });
    setDesignerMode(project.designerWebsite ? 'website' : 'name');
    setDesignerPreviewMessage('');
  }, [project?.id, project?.completedAt, editForm.reset]);
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
  const progressForm = useForm<{ notes: string; completionPercent: number }>({
    defaultValues: { notes: '', completionPercent: project?.completionPercent ?? 0 },
  });
  const invalidate = () => {
    void client.invalidateQueries({ queryKey: getGetProjectQueryKey(projectId) });
    void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
    void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
  };
  const saveEdit = editForm.handleSubmit((values) => {
    const payload: UpdateProject = {
      title: values.title.trim(), craft: values.craft, status: values.status,
      description: values.description || null, patternName: values.patternName || null,
      patternDesigner: values.patternDesigner.trim() || null,
      designerWebsite: designerMode === 'website' ? values.designerWebsite.trim() || null : null,
      designerPageTitle: designerMode === 'website' ? values.designerPageTitle.trim() || null : null,
      yarnBrand: values.yarnBrand.trim() || null,
      yarnType: values.yarnType.trim() || null,
      yarnColor: values.yarnColor.trim() || null,
      tools: values.tools || null,
      hookSize: values.craft === 'crochet' ? values.hookSize || null : null,
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
    };
    update.mutate({ projectId, data: payload }, { onSuccess: () => { invalidate(); setEditing(false); } });
  });
  const submitProgress = progressForm.handleSubmit(async (values) => {
    const payload: CreateProgress = { notes: values.notes.trim(), completionPercent: Number(values.completionPercent) };
    setProgressPhotoError('');
    try {
      if (progressPhoto) {
        if (progressPhoto.size > 10 * 1024 * 1024) {
          setProgressPhotoError('Choose a photo smaller than 10 MB.');
          return;
        }
        if (!['image/jpeg', 'image/png', 'image/webp'].includes(progressPhoto.type)) {
          setProgressPhotoError('Choose a JPEG, PNG, or WebP photo.');
          return;
        }
        const contentType = progressPhoto.type as 'image/jpeg' | 'image/png' | 'image/webp';
        const upload = await requestProgressPhotoUpload(projectId, {
          name: progressPhoto.name || 'progress-photo',
          size: progressPhoto.size,
          contentType,
        });
        const uploaded = await fetch(upload.uploadURL, {
          method: 'PUT',
          headers: { 'Content-Type': contentType },
          body: progressPhoto,
        });
        if (!uploaded.ok) throw new Error('The photo upload did not finish.');
        payload.photoPath = upload.photoPath;
      }
      addProgress.mutate({ projectId, data: payload }, {
        onSuccess: trackSuccessfulAction('progress_updated', () => {
          invalidate();
          setShowProgress(false);
          setProgressPhoto(null);
          progressForm.reset({ notes: '', completionPercent: Math.max(Number(values.completionPercent), project?.completionPercent || 0) });
        }),
      });
    } catch {
      setProgressPhotoError('We couldn’t upload that photo. Try again or save without it.');
    }
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
    {confirmDelete && <div className="confirm-banner"><div><b>Delete this project?</b><span>This will permanently remove the project and its progress notes.</span></div><button className="button button-quiet" onClick={() => setConfirmDelete(false)} data-testid="button-cancel-delete">Cancel</button><button className="button button-danger" onClick={deleteProject} disabled={remove.isPending} data-testid="button-confirm-delete">{remove.isPending ? 'Removing…' : 'Delete project'}</button></div>}
    {editing && <Form {...editForm}><form className="edit-form loom-card" onSubmit={saveEdit} noValidate><div className="form-intro"><h2 className="serif">Edit details</h2></div><div className="form-grid">
      <div className="field-block field-wide"><label htmlFor="edit-title">Project name</label><input id="edit-title" {...editForm.register('title', { required: 'Project name is required.' })} data-testid="input-edit-title"/></div>
      <div className="field-block"><label htmlFor="edit-craft">Craft</label><select id="edit-craft" {...editForm.register('craft')} data-testid="select-edit-craft"><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select></div>
      <div className="field-block"><label htmlFor="edit-status">Status</label><select id="edit-status" {...editForm.register('status')} data-testid="select-edit-status"><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select></div>
      <div className="field-block"><label htmlFor="edit-pattern">Pattern name</label><input id="edit-pattern" {...editForm.register('patternName')} data-testid="input-edit-pattern"/></div>
       <DesignerEntry form={editForm} mode={designerMode} onModeChange={(mode) => { setDesignerMode(mode); setDesignerPreviewMessage(''); }} onPreview={previewEditDesignerTitle} onClearPreview={() => setDesignerPreviewMessage('')} isPreviewing={previewTitle.isPending} message={designerPreviewMessage} prefix="edit"/>
      <div className="yarn-group field-wide">
        <div className="yarn-group-heading"><b>Yarn</b></div>
        <div className="yarn-trifold">
          <div className="field-block"><label htmlFor="edit-yarn-brand">Brand</label><input id="edit-yarn-brand" placeholder="e.g. Cascade" {...editForm.register('yarnBrand')} data-testid="input-edit-yarn-brand"/></div>
          <div className="field-block"><label htmlFor="edit-yarn-type">Type</label><input id="edit-yarn-type" placeholder="e.g. Merino DK" {...editForm.register('yarnType')} data-testid="input-edit-yarn-type"/></div>
          <div className="field-block"><label htmlFor="edit-yarn-color">Color</label><input id="edit-yarn-color" placeholder="e.g. Oatmeal" {...editForm.register('yarnColor')} data-testid="input-edit-yarn-color"/></div>
        </div>
        {project.yarn && <p className="legacy-yarn-note"><b>Saved yarn note:</b> {project.yarn} <span>This earlier entry is being kept unchanged.</span></p>}
      </div>
      {editForm.watch('craft') === 'crochet' ? (
        <div className="field-block"><label htmlFor="edit-hook-size">Hook size</label><select id="edit-hook-size" {...editForm.register('hookSize')} data-testid="select-edit-crochet-hook-size"><option value="">Choose a hook size</option>{crochetHookSizes.map((hookSize) => <option key={hookSize} value={hookSize}>{hookSize}</option>)}</select>{project.tools && <p className="legacy-yarn-note"><b>Saved tools note:</b> {project.tools}<span>This earlier note is being kept unchanged.</span></p>}</div>
      ) : (
        <div className="field-block"><label htmlFor="edit-tools">Tools</label><input id="edit-tools" {...editForm.register('tools')} data-testid="input-edit-tools"/></div>
      )}
       <ProjectDateField id="edit-started" label="Started on" value={editForm.watch('startedAt')} precision={editForm.watch('startedAtPrecision')} onValueChange={(value) => editForm.setValue('startedAt', value)} onPrecisionChange={(precision) => editForm.setValue('startedAtPrecision', precision)} testId="input-edit-start-date"/>
       <ProjectDateField id="edit-target" label="Target date" value={editForm.watch('targetDate')} precision={editForm.watch('targetDatePrecision')} onValueChange={(value) => editForm.setValue('targetDate', value)} onPrecisionChange={(precision) => editForm.setValue('targetDatePrecision', precision)} testId="input-edit-target-date"/>
       {editForm.watch('status') === 'completed' && <ProjectDateField id="edit-completed" label="Finished on" value={editForm.watch('completedAt')} precision={editForm.watch('completedAtPrecision')} onValueChange={(value) => editForm.setValue('completedAt', value)} onPrecisionChange={(precision) => editForm.setValue('completedAtPrecision', precision)} testId="input-edit-completed-date"/>}
      <div className="field-block field-wide"><label htmlFor="edit-description">Notes</label><textarea id="edit-description" rows={3} {...editForm.register('description')} data-testid="input-edit-description"/></div>
    </div>{update.isError && <p className="mutation-error">We couldn't save those changes. Try again.</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(false)} data-testid="button-cancel-edit">Cancel</button><button className="button button-primary" type="submit" disabled={update.isPending} data-testid="button-update-project">{update.isPending ? 'Saving…' : 'Save changes'} <Check size={15}/></button></div></form></Form>}
    <section className="detail-main-grid">
      <div className="detail-primary">
        <article className="progress-hero loom-card"><div className="progress-hero-copy"><h2 className="serif">Progress</h2><p>{progressSummary(project.progress)}</p></div><div className="progress-ring" style={{ '--progress': `${project.completionPercent * 3.6}deg` } as CSSProperties}><div><strong>{project.completionPercent}<small>%</small></strong><span>complete</span></div></div></article>
        <div className="progress-log-heading"><div><h2 className="serif">Progress journal</h2></div><button className="button button-primary button-small" onClick={() => { setShowProgress(!showProgress); progressForm.setValue('completionPercent', project.completionPercent); }} data-testid="button-add-progress">{showProgress ? <X size={15}/> : <Plus size={15}/>} {showProgress ? 'Close note' : 'Add a note'}</button></div>
        {showProgress && <Form {...progressForm}><form className="progress-form loom-card" onSubmit={submitProgress} noValidate><div className="field-block"><label htmlFor="progress-notes">What did you work on?</label><textarea id="progress-notes" rows={3} placeholder="A few rows, a tricky bit figured out, a lovely color change…" {...progressForm.register('notes', { required: 'Add a note about this session.', maxLength: { value: 2000, message: 'Keep your note under 2,000 characters.' } })} data-testid="input-progress-notes"/>{progressForm.formState.errors.notes && <span className="field-error">{progressForm.formState.errors.notes.message}</span>}</div><div className="field-block progress-photo-field"><label htmlFor="progress-photo">Add a progress photo (optional)</label><input id="progress-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setProgressPhoto(event.target.files?.[0] ?? null); setProgressPhotoError(''); }} data-testid="input-progress-photo"/>{progressPhotoPreview && <div className="progress-photo-preview"><img src={progressPhotoPreview} alt="Selected progress photo preview"/><button type="button" className="button button-quiet" onClick={() => setProgressPhoto(null)}>Remove photo</button></div>}</div><div className="progress-form-row"><div className="field-block"><label htmlFor="progress-percent">Overall completion</label><div className="percent-input"><input id="progress-percent" type="number" min={0} max={100} {...progressForm.register('completionPercent', { valueAsNumber: true, min: 0, max: 100 })} data-testid="input-progress-percent"/><span>%</span></div></div></div>{(addProgress.isError || progressPhotoError) && <p className="mutation-error">{progressPhotoError || "Your note didn't stick this time. Please try again."}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setShowProgress(false); setProgressPhoto(null); }} data-testid="button-cancel-progress">Cancel</button><button type="submit" className="button button-primary" disabled={addProgress.isPending} data-testid="button-save-progress">{addProgress.isPending ? 'Saving note…' : 'Save progress'} <ArrowRight size={15}/></button></div></form></Form>}
        {photoRemovalError && <p className="mutation-error" role="alert">{photoRemovalError}</p>}
        {project.progress.length ? <div className="timeline">{[...project.progress].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry) => <article className="timeline-entry" key={entry.id} data-testid={`entry-progress-${entry.id}`}><span className="timeline-marker"><Feather size={13}/></span><div className="timeline-card loom-card"><div className="timeline-entry-top"><time>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(entry.createdAt))}</time><b>{entry.completionPercent}% complete</b></div><p>{entry.notes}</p>{entry.photoPath && <><img className="timeline-photo" src={`/api/projects/${projectId}/progress/${entry.id}/photo`} alt={`Progress photo for ${project.title}`} loading="lazy"/><button type="button" className="button button-quiet button-remove-progress-photo" onClick={() => deleteEntryPhoto(entry.id)} disabled={removingPhotoEntryId === entry.id} data-testid={`button-remove-progress-photo-${entry.id}`}>{removingPhotoEntryId === entry.id ? 'Removing photo…' : 'Remove photo'} <X size={14}/></button></>}<ProgressBar value={entry.completionPercent}/></div></article>)}</div> : <div className="journal-empty"><h3>No notes yet</h3><p>Add a note each time you work on this project.</p><button className="button button-outline" onClick={() => setShowProgress(true)} data-testid="button-first-progress">Add your first note <ArrowRight size={15}/></button></div>}
      </div>
      <aside className="detail-aside">
        <div className="aside-card loom-card"><h3 className="serif">Details</h3><dl className="detail-list">
          <div><dt>Pattern</dt><dd>{project.patternName || 'Not added yet'}</dd></div>
          <div><dt>Designer</dt><dd>{project.designerWebsite ? <a href={project.designerWebsite} target="_blank" rel="noopener noreferrer" data-testid="link-designer-website">{designerWebsiteLabel(project.designerWebsite, project.designerPageTitle, project.patternDesigner)}</a> : project.patternDesigner || 'Not added yet'}</dd></div>
          <div><dt>Yarn</dt><dd>{formatYarnDetails(project) || 'Not added yet'}</dd></div>
          {project.yarn && (project.yarnBrand || project.yarnType || project.yarnColor) && <div><dt>Previous yarn note</dt><dd>{project.yarn}</dd></div>}
          <div><dt>{project.craft === 'crochet' ? 'Hook size' : 'Tools'}</dt><dd>{project.craft === 'crochet' ? project.hookSize || 'Not added yet' : project.tools || 'Not added yet'}</dd></div>
          {project.craft === 'crochet' && project.tools && <div><dt>Saved tools note</dt><dd>{project.tools}</dd></div>}
          <div><dt>Target date</dt><dd>{formatProjectDate(project.targetDate, project.targetDatePrecision) || 'No date in mind'}</dd></div>
          {project.completedAt && <div><dt>Finished on</dt><dd data-testid="text-completed-date">{formatProjectDate(project.completedAt, project.completedAtPrecision)}</dd></div>}
        </dl>{project.description && <div className="personal-note"><span>Notes</span><p>{project.description}</p></div>}<button className="aside-edit" onClick={() => setEditing(!editing)} data-testid="button-edit-details"><Feather size={14}/> Edit details</button></div>
      </aside>
    </section>
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
        start: { title: 'Welcome back', subtitle: 'Pick up right where you left off.' },
      },
      signUp: {
        start: { title: 'Make a little room', subtitle: 'Your projects deserve a place of their own.' },
      },
    }}
    routerPush={(to) => setLocation(stripBase(to))}
    routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
  >
    <QueryClientProvider client={queryClient}><TooltipProvider><ClerkCacheInvalidator/>
      <Switch>
        <Route path="/" component={HomeRoute}/>
        <Route path="/sign-in/*?" component={SignInPage}/>
        <Route path="/sign-up/*?" component={SignUpPage}/>
        <Route path="/dashboard"><PrivateRoute><DashboardPage/></PrivateRoute></Route>
        <Route path="/projects"><PrivateRoute><ProjectsPage/></PrivateRoute></Route>
        <Route path="/projects/new"><PrivateRoute><ProjectFormPage/></PrivateRoute></Route>
        <Route path="/projects/:projectId">{(params) => <PrivateRoute><ProjectDetailPage projectId={params.projectId}/></PrivateRoute>}</Route>
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
