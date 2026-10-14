import { type ReactNode, useEffect, useRef, useState } from 'react';
import type { CSSProperties } from 'react';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
import { ClerkProvider, SignIn, SignUp, useAuth, useClerk, useSignUp, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import {
  requestProgressPhotoUpload, useAddProgress, useCreateProject, useDeleteProgressPhoto, useDeleteProject, useGetDashboard,
  useGetProject, useGetProjects, useUpdateProject,
  getGetDashboardQueryKey, getGetProjectQueryKey, getGetProjectsQueryKey,
} from '@workspace/api-client-react';
import type { CreateProject, CreateProgress, Project, ProjectStatus, UpdateProject } from '@workspace/api-client-react';
import { Form, useForm } from 'react-hook-form';
import {
  ArrowDownRight, ArrowLeft, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronDown, CircleHelp, Clock3, Feather, Filter, Flower2, Gauge,
  Heart, Layers3, LogOut, Menu, Plus, Search, Sparkles, Trash2,
  TrendingUp, X,
} from 'lucide-react';
import {
  Link, Redirect, Route, Switch, useLocation, Router as WouterRouter,
} from 'wouter';
import { ErrorBoundary } from '@/components/error-boundary';
import { trackEvent } from '@/lib/analytics';
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
    colorPrimary: '#51458a',
    colorForeground: '#302c43',
    colorMutedForeground: '#777184',
    colorDanger: '#a3413f',
    colorBackground: '#fffdf8',
    colorInput: '#fbf8f0',
    colorInputForeground: '#302c43',
    colorNeutral: '#e4ddcf',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '1rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fffdf8] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-sm',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#302c43] font-serif',
    headerSubtitle: 'text-[#777184]',
    socialButtonsBlockButtonText: 'text-[#302c43] font-medium',
    formFieldLabel: 'text-[#302c43] font-medium',
    footerActionLink: 'text-[#51458a] font-semibold',
    footerActionText: 'text-[#777184]',
    dividerText: 'text-[#777184]',
    identityPreviewEditButton: 'text-[#51458a]',
    formFieldSuccessText: 'text-[#36745d]',
    alertText: 'text-[#302c43]',
    logoBox: 'mb-4',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#e4ddcf] bg-[#fbf8f0] hover:bg-[#f4efe5]',
    formButtonPrimary: 'bg-[#51458a] hover:bg-[#403672] shadow-none',
    formFieldInput: 'bg-[#fbf8f0] border-[#e4ddcf] text-[#302c43]',
    footerAction: 'border-t border-[#e4ddcf]',
    dividerLine: 'bg-[#e4ddcf]',
    alert: 'bg-[#fbf4e7] border-[#e4ddcf]',
    otpCodeFieldInput: 'bg-[#fbf8f0] border-[#e4ddcf]',
    formFieldRow: 'mb-4',
    main: 'text-[#302c43]',
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
  const trackedSession = useRef<string | null>(null);

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
      <div className="rail-caption">YOUR WORKROOM</div>
      <nav className="rail-nav">
        <Link href="/dashboard" className={`rail-link ${active === 'dashboard' ? 'selected' : ''}`} data-testid="link-dashboard"><Layers3 size={18}/><span>Overview</span></Link>
        <Link href="/projects" className={`rail-link ${active === 'projects' ? 'selected' : ''}`} data-testid="link-projects"><BookOpen size={18}/><span>My projects</span></Link>
      </nav>
      <div className="rail-note"><span className="rail-note-icon"><Feather size={16}/></span><p>Keep the little notes.<br/><b>They become the story.</b></p><span className="rail-stitch"/></div>
      <div className="rail-bottom"><div className="profile-chip"><span className="profile-initial">{initials}</span><span className="profile-name">{displayName}<small>Your workroom</small></span><button type="button" title="Sign out" aria-label="Sign out" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={16}/></button></div></div>
    </aside>
    {mobileOpen && <button className="mobile-scrim" onClick={() => setMobileOpen(false)} aria-label="Close navigation" data-testid="button-dismiss-navigation"/>}
    <main className="portal-main">
      <header className="portal-topbar"><button className="menu-toggle" onClick={() => setMobileOpen(true)} aria-label="Open navigation" data-testid="button-open-navigation"><Menu size={21}/></button><div className="breadcrumbs"><span>Mwedi Threads</span><i>/</i><b>{active === 'dashboard' ? 'Overview' : 'My projects'}</b></div><div className="topbar-end"><span className="today-label">{new Intl.DateTimeFormat('en', { weekday: 'short', month: 'long', day: 'numeric' }).format(new Date())}</span><span className="top-avatar">{initials}</span></div></header>
      <div className="portal-content appear">{children}</div>
    </main>
  </div>;
}

function PageHeading({ overline, title, subtitle, action }: { overline: string; title: ReactNode; subtitle: string; action?: ReactNode }) {
  return <div className="page-heading"><div><div className="eyebrow"><span className="eyebrow-stitch"/>{overline}</div><h1 className="page-title serif">{title}</h1><p>{subtitle}</p></div>{action}</div>;
}

function QueryProblem({ retry, message = 'We couldn’t gather this just now.' }: { retry: () => void; message?: string }) {
  return <div className="query-problem"><span><CircleHelp size={20}/></span><h3>A little snag in the thread</h3><p>{message} Your work is safe — give it another try.</p><button className="button button-outline" onClick={retry} data-testid="button-retry">Try again <ArrowRight size={16}/></button></div>;
}

function ProgressBar({ value }: { value: number }) {
  return <div className="progress-track" aria-label={`${value}% complete`}><span style={{ width: `${Math.min(100, Math.max(0, value))}%` }}/></div>;
}

function StatusPill({ status }: { status: ProjectStatus }) {
  const labels: Record<ProjectStatus, string> = { planning: 'On the needles', in_progress: 'In progress', paused: 'On pause', completed: 'Finished' };
  return <span className={`status-pill status-${status}`} data-testid={`status-project-${status}`}>{status === 'completed' && <Check size={12}/>} {labels[status]}</span>;
}

function ProjectCard({ project }: { project: Project }) {
  const craftLabel = project.craft === 'knitting' ? 'Knitting' : 'Crochet';
  return <Link href={`/projects/${project.id}`} className="project-card loom-card lift" data-testid={`card-project-${project.id}`}>
    <div className={`project-card-art art-${project.craft}`}><span className="art-kicker">{craftLabel}</span><span className="art-mark">{project.craft === 'knitting' ? '〰' : '⌘'}</span><span className="art-corner">{project.completionPercent}%</span></div>
    <div className="project-card-body"><div className="project-card-meta"><StatusPill status={project.status}/><span className="updated-label">{project.updatedAt ? `Updated ${new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(project.updatedAt))}` : ''}</span></div><h3>{project.title}</h3><p>{project.patternName || project.description || `${craftLabel} project`}</p><ProgressBar value={project.completionPercent}/><div className="card-foot"><span>{project.yarn || 'Details tucked away'}</span><ArrowUpRight size={16}/></div></div>
  </Link>;
}

function DashboardPage() {
  const query = useGetDashboard({ query: { queryKey: getGetDashboardQueryKey() } });
  const data = query.data;
  const { user } = useUser();
  const name = user?.firstName || 'maker';
  return <PortalLayout active="dashboard">
    <PageHeading overline="YOUR WORKROOM" title={<>Good to see you, {name}.</>} subtitle="A little look at all the good things taking shape." action={<Link href="/projects/new" className="button button-primary" data-testid="link-new-project"><Plus size={17}/> New project</Link>}/>
    {query.isLoading ? <div className="dashboard-loading"><div className="stat-skeleton"/><div className="stat-skeleton"/><div className="stat-skeleton"/></div> : query.isError || !data ? <QueryProblem retry={() => query.refetch()}/> : <>
      <section className="stat-row" aria-label="Project totals">
        <div className="stat-card stat-card-featured"><span className="stat-label"><Layers3 size={16}/> IN YOUR WORKROOM</span><strong>{data.totalProjects}</strong><span className="stat-caption">projects, gathered in one place</span><div className="stat-decoration">〰</div></div>
        <div className="stat-card"><span className="stat-label"><Clock3 size={16}/> TAKING SHAPE</span><strong>{data.activeProjects}</strong><span className="stat-caption">active works in progress</span><div className="stat-mini-line"><i/></div></div>
        <div className="stat-card"><span className="stat-label"><Check size={16}/> ON THE SHELF</span><strong>{data.completedProjects}</strong><span className="stat-caption">finished and ready to love</span><div className="stat-confetti"><span/><span/><span/></div></div>
      </section>
      <section className="dashboard-grid">
        <div className="dashboard-work">
          <div className="section-heading"><div><span className="eyebrow">A FEW THINGS IN MOTION</span><h2 className="serif">Back on your needles</h2></div><Link href="/projects" className="quiet-link" data-testid="link-view-all-projects">All projects <ArrowRight size={15}/></Link></div>
          {data.recentProjects.length ? <div className="project-card-grid">{data.recentProjects.slice(0, 3).map((project) => <ProjectCard key={project.id} project={project}/>)}</div> : <EmptyProjects compact/>}
        </div>
        <aside className="recent-panel loom-card">
          <div className="section-heading"><div><span className="eyebrow">LITTLE BY LITTLE</span><h2 className="serif">Recent notes</h2></div><span className="recent-icon"><Feather size={17}/></span></div>
          {data.recentProgress.length ? <div className="notes-list">{data.recentProgress.slice(0, 5).map((item, index) => <Link key={`${item.projectId}-${item.createdAt}`} href={`/projects/${item.projectId}`} className="note-row" data-testid={`link-progress-note-${index}`}><span className="note-dot"/><span className="note-row-copy"><b>{item.projectTitle}</b><span>{item.notes}</span><small>{new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric' }).format(new Date(item.createdAt))} · now {item.completionPercent}%</small></span><ArrowUpRight size={14}/></Link>)}</div> : <div className="notes-empty"><Feather size={21}/><p>Your progress notes will find a home here.</p><span>Every little session counts.</span></div>}
        </aside>
      </section>
      <div className="dashboard-footer-note"><Sparkles size={15}/><span>There's no rush. The best things are made one stitch at a time.</span></div>
    </>}
  </PortalLayout>;
}

function EmptyProjects({ compact = false }: { compact?: boolean }) {
  return <div className={`empty-projects ${compact ? 'empty-compact' : ''}`}><div className="empty-art"><span className="empty-loop">〰</span><span className="empty-dot"/></div><h3>Your next project starts here.</h3><p>Gather a pattern, choose a yarn, and give your next idea its own little page.</p><Link href="/projects/new" className="button button-primary" data-testid="link-create-first-project"><Plus size={16}/> Start a project</Link></div>;
}

function ProjectsPage() {
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [craft, setCraft] = useState('');
  const params = {
    ...(search.trim() ? { search: search.trim() } : {}),
    ...(status ? { status: status as ProjectStatus } : {}),
    ...(craft ? { craft: craft as 'knitting' | 'crochet' } : {}),
  };
  const query = useGetProjects(params, { query: { queryKey: getGetProjectsQueryKey(params) } });
  return <PortalLayout active="projects">
    <PageHeading overline="YOUR COLLECTION" title="My projects" subtitle="Every idea, skein, and finished piece — gathered together." action={<Link href="/projects/new" className="button button-primary" data-testid="link-add-project"><Plus size={17}/> Add a project</Link>}/>
    <div className="catalog-tools">
      <label className="search-box"><Search size={17}/><input type="search" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Find a project…" aria-label="Search projects" data-testid="input-search-projects"/>{search && <button type="button" onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={15}/></button>}</label>
      <label className="select-wrap"><Filter size={15}/><select aria-label="Filter by status" value={status} onChange={(event) => setStatus(event.target.value)} data-testid="select-status-filter"><option value="">Every status</option><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select><ChevronDown size={14}/></label>
      <label className="select-wrap"><select aria-label="Filter by craft" value={craft} onChange={(event) => setCraft(event.target.value)} data-testid="select-craft-filter"><option value="">Every craft</option><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select><ChevronDown size={14}/></label>
      {(search || status || craft) && <button className="clear-filters" onClick={() => { setSearch(''); setStatus(''); setCraft(''); }} data-testid="button-clear-filters">Clear filters</button>}
    </div>
    <div className="catalog-result-caption">{query.data ? <><b>{query.data.length}</b> {query.data.length === 1 ? 'project' : 'projects'} in your collection</> : 'Your collection'}</div>
    {query.isLoading ? <div className="project-card-grid">{[0, 1, 2].map((item) => <div className="card-skeleton" key={item}/>)}</div> : query.isError ? <QueryProblem retry={() => query.refetch()}/> : query.data?.length ? <div className="project-card-grid catalog-grid">{query.data.map((project) => <ProjectCard key={project.id} project={project}/>)}</div> : search || status || craft ? <div className="no-results"><Search size={23}/><h3>Nothing in this little corner yet</h3><p>Try a different search or loosen one of the filters.</p><button className="button button-outline" onClick={() => { setSearch(''); setStatus(''); setCraft(''); }} data-testid="button-reset-filters">Reset filters</button></div> : <EmptyProjects/>}
  </PortalLayout>;
}

type ProjectFormValues = {
  title: string; craft: 'knitting' | 'crochet'; status: ProjectStatus;
  description: string; patternName: string; patternDesigner: string;
  yarn: string; tools: string; startedAt: string; targetDate: string;
};

function ProjectFormPage() {
  const [, setLocation] = useLocation();
  const client = useQueryClient();
  const create = useCreateProject();
  const form = useForm<ProjectFormValues>({
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', yarn: '', tools: '', startedAt: '', targetDate: '' },
  });
  const submit = form.handleSubmit((values) => {
    const payload: CreateProject = {
      title: values.title.trim(), craft: values.craft, status: values.status,
      description: values.description || null, patternName: values.patternName || null,
      patternDesigner: values.patternDesigner || null, yarn: values.yarn || null,
      tools: values.tools || null, startedAt: values.startedAt || null, targetDate: values.targetDate || null,
    };
    create.mutate({ data: payload }, {
      onSuccess: (project) => {
        trackEvent('project_created');
        void client.invalidateQueries({ queryKey: getGetProjectsQueryKey() });
        void client.invalidateQueries({ queryKey: getGetDashboardQueryKey() });
        setLocation(`/projects/${project.id}`);
      },
    });
  });
  return <PortalLayout active="projects">
    <Link href="/projects" className="back-link" data-testid="link-back-projects"><ArrowLeft size={16}/> Back to projects</Link>
    <PageHeading overline="A FRESH CAST-ON" title="Start a project" subtitle="Give your idea a place to take shape."/>
    <Form {...form}><form className="project-form loom-card" onSubmit={submit} noValidate>
      <div className="form-intro"><span className="form-number">01</span><div><h2 className="serif">The beginnings</h2><p>Start with a name and the way you like to make.</p></div><span className="form-icon"><Feather size={18}/></span></div>
      <div className="form-grid">
        <div className="field-block field-wide"><label htmlFor="project-title">Project name <b>*</b></label><input id="project-title" maxLength={160} placeholder="e.g. Juniper cardigan" {...form.register('title', { required: 'Give your project a name to get started.' })} data-testid="input-project-title"/>{form.formState.errors.title && <span className="field-error">{form.formState.errors.title.message}</span>}</div>
        <div className="field-block"><label htmlFor="project-craft">Craft</label><select id="project-craft" {...form.register('craft')} data-testid="select-project-craft"><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select></div>
        <div className="field-block"><label htmlFor="project-status">Where it is now</label><select id="project-status" {...form.register('status')} data-testid="select-project-status"><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select></div>
      </div>
      <div className="form-divider"><span>THE LOVELY DETAILS</span><i/></div>
      <div className="form-grid">
        <div className="field-block"><label htmlFor="pattern-name">Pattern name</label><input id="pattern-name" placeholder="Pattern or source" {...form.register('patternName')} data-testid="input-pattern-name"/></div>
        <div className="field-block"><label htmlFor="pattern-designer">Designer</label><input id="pattern-designer" placeholder="Who made the pattern?" {...form.register('patternDesigner')} data-testid="input-pattern-designer"/></div>
        <div className="field-block"><label htmlFor="project-yarn">Yarn</label><input id="project-yarn" placeholder="Fiber, color, weight…" {...form.register('yarn')} data-testid="input-project-yarn"/></div>
        <div className="field-block"><label htmlFor="project-tools">Tools</label><input id="project-tools" placeholder="Needle or hook size…" {...form.register('tools')} data-testid="input-project-tools"/></div>
        <div className="field-block"><label htmlFor="project-start">Started on</label><input id="project-start" type="date" {...form.register('startedAt')} data-testid="input-start-date"/></div>
        <div className="field-block"><label htmlFor="project-target">Aiming for (optional)</label><input id="project-target" type="date" {...form.register('targetDate')} data-testid="input-target-date"/></div>
        <div className="field-block field-wide"><label htmlFor="project-description">Notes to future you</label><textarea id="project-description" rows={3} placeholder="What made you fall for this one?" {...form.register('description')} data-testid="input-project-description"/></div>
      </div>
      {create.isError && <p className="mutation-error" role="alert">We couldn't save that project just now. Your details are still here — please try again.</p>}
      <div className="form-actions"><Link href="/projects" className="button button-quiet" data-testid="link-cancel-project">Maybe later</Link><button type="submit" className="button button-primary" disabled={create.isPending} data-testid="button-save-project">{create.isPending ? 'Tucking it away…' : 'Save this project'}{!create.isPending && <ArrowRight size={16}/>}</button></div>
    </form></Form>
  </PortalLayout>;
}

function ProjectDetailPage({ projectId }: { projectId: string }) {
  const query = useGetProject(projectId, { query: { queryKey: getGetProjectQueryKey(projectId) } });
  const [editing, setEditing] = useState(false);
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
    defaultValues: { title: '', craft: 'knitting', status: 'planning', description: '', patternName: '', patternDesigner: '', yarn: '', tools: '', startedAt: '', targetDate: '' },
  });
  useEffect(() => {
    if (!project) return;
    editForm.reset({
      title: project.title, craft: project.craft, status: project.status,
      description: project.description || '', patternName: project.patternName || '',
      patternDesigner: project.patternDesigner || '', yarn: project.yarn || '',
      tools: project.tools || '', startedAt: project.startedAt?.slice(0, 10) || '',
      targetDate: project.targetDate?.slice(0, 10) || '',
    });
  }, [project?.id, editForm.reset]);
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
      patternDesigner: values.patternDesigner || null, yarn: values.yarn || null,
      tools: values.tools || null, startedAt: values.startedAt || null, targetDate: values.targetDate || null,
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
        onSuccess: () => {
          trackEvent('progress_updated');
          invalidate();
          setShowProgress(false);
          setProgressPhoto(null);
          progressForm.reset({ notes: '', completionPercent: Math.max(Number(values.completionPercent), project?.completionPercent || 0) });
        },
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
    <div className="detail-heading"><div><div className="eyebrow"><span className="eyebrow-stitch"/>{craftLabel} · PROJECT JOURNAL</div><h1 className="serif">{project.title}</h1><div className="detail-status"><StatusPill status={project.status}/><span>Started {project.startedAt ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(project.startedAt)) : 'when you were ready'}</span></div></div><div className="detail-actions"><button className="button button-outline" onClick={() => setEditing(!editing)} data-testid="button-edit-project">{editing ? <X size={16}/> : <Feather size={16}/>} {editing ? 'Close edit' : 'Edit details'}</button><button className="icon-button danger-icon" aria-label="Delete project" title="Delete project" onClick={() => setConfirmDelete(true)} data-testid="button-delete-project"><Trash2 size={17}/></button></div></div>
    {confirmDelete && <div className="confirm-banner"><div><b>Let this one go?</b><span>This will permanently remove the project and its progress notes.</span></div><button className="button button-quiet" onClick={() => setConfirmDelete(false)} data-testid="button-cancel-delete">Keep it</button><button className="button button-danger" onClick={deleteProject} disabled={remove.isPending} data-testid="button-confirm-delete">{remove.isPending ? 'Removing…' : 'Delete project'}</button></div>}
    {editing && <Form {...editForm}><form className="edit-form loom-card" onSubmit={saveEdit} noValidate><div className="form-intro"><span className="form-number">EDIT</span><div><h2 className="serif">Project details</h2><p>Change any detail whenever the project shifts.</p></div></div><div className="form-grid">
      <div className="field-block field-wide"><label htmlFor="edit-title">Project name</label><input id="edit-title" {...editForm.register('title', { required: 'Project name is required.' })} data-testid="input-edit-title"/></div>
      <div className="field-block"><label htmlFor="edit-craft">Craft</label><select id="edit-craft" {...editForm.register('craft')} data-testid="select-edit-craft"><option value="knitting">Knitting</option><option value="crochet">Crochet</option></select></div>
      <div className="field-block"><label htmlFor="edit-status">Status</label><select id="edit-status" {...editForm.register('status')} data-testid="select-edit-status"><option value="planning">Planning</option><option value="in_progress">In progress</option><option value="paused">On pause</option><option value="completed">Finished</option></select></div>
      <div className="field-block"><label htmlFor="edit-pattern">Pattern name</label><input id="edit-pattern" {...editForm.register('patternName')} data-testid="input-edit-pattern"/></div>
      <div className="field-block"><label htmlFor="edit-designer">Designer</label><input id="edit-designer" {...editForm.register('patternDesigner')} data-testid="input-edit-designer"/></div>
      <div className="field-block"><label htmlFor="edit-yarn">Yarn</label><input id="edit-yarn" {...editForm.register('yarn')} data-testid="input-edit-yarn"/></div>
      <div className="field-block"><label htmlFor="edit-tools">Tools</label><input id="edit-tools" {...editForm.register('tools')} data-testid="input-edit-tools"/></div>
      <div className="field-block"><label htmlFor="edit-started">Started on</label><input id="edit-started" type="date" {...editForm.register('startedAt')} data-testid="input-edit-start-date"/></div>
      <div className="field-block"><label htmlFor="edit-target">Target date</label><input id="edit-target" type="date" {...editForm.register('targetDate')} data-testid="input-edit-target-date"/></div>
      <div className="field-block field-wide"><label htmlFor="edit-description">Notes</label><textarea id="edit-description" rows={3} {...editForm.register('description')} data-testid="input-edit-description"/></div>
    </div>{update.isError && <p className="mutation-error">We couldn't save those changes. Try again.</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => setEditing(false)} data-testid="button-cancel-edit">Cancel</button><button className="button button-primary" type="submit" disabled={update.isPending} data-testid="button-update-project">{update.isPending ? 'Saving…' : 'Save changes'} <Check size={15}/></button></div></form></Form>}
    <section className="detail-main-grid">
      <div className="detail-primary">
        <article className="progress-hero loom-card"><div className="progress-hero-copy"><span className="eyebrow">THE LONG AND LOVELY MIDDLE</span><h2 className="serif">Look how far<br/>you've come.</h2><p>Your progress doesn't need to be perfect to count.</p></div><div className="progress-ring" style={{ '--progress': `${project.completionPercent * 3.6}deg` } as CSSProperties}><div><strong>{project.completionPercent}<small>%</small></strong><span>complete</span></div></div><span className="hero-ornament">〰</span></article>
        <div className="progress-log-heading"><div><span className="eyebrow">NOTES FROM THE MAKING</span><h2 className="serif">Progress journal</h2></div><button className="button button-primary button-small" onClick={() => { setShowProgress(!showProgress); progressForm.setValue('completionPercent', project.completionPercent); }} data-testid="button-add-progress">{showProgress ? <X size={15}/> : <Plus size={15}/>} {showProgress ? 'Close note' : 'Add a note'}</button></div>
        {showProgress && <Form {...progressForm}><form className="progress-form loom-card" onSubmit={submitProgress} noValidate><div className="field-block"><label htmlFor="progress-notes">What did you work on?</label><textarea id="progress-notes" rows={3} placeholder="A few rows, a tricky bit figured out, a lovely color change…" {...progressForm.register('notes', { required: 'Add a note about this session.', maxLength: { value: 2000, message: 'Keep your note under 2,000 characters.' } })} data-testid="input-progress-notes"/>{progressForm.formState.errors.notes && <span className="field-error">{progressForm.formState.errors.notes.message}</span>}</div><div className="field-block progress-photo-field"><label htmlFor="progress-photo">Add a progress photo (optional)</label><input id="progress-photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => { setProgressPhoto(event.target.files?.[0] ?? null); setProgressPhotoError(''); }} data-testid="input-progress-photo"/>{progressPhotoPreview && <div className="progress-photo-preview"><img src={progressPhotoPreview} alt="Selected progress photo preview"/><button type="button" className="button button-quiet" onClick={() => setProgressPhoto(null)}>Remove photo</button></div>}</div><div className="progress-form-row"><div className="field-block"><label htmlFor="progress-percent">Overall completion</label><div className="percent-input"><input id="progress-percent" type="number" min={0} max={100} {...progressForm.register('completionPercent', { valueAsNumber: true, min: 0, max: 100 })} data-testid="input-progress-percent"/><span>%</span></div></div><div className="progress-form-hint"><Sparkles size={15}/> A little progress is still progress.</div></div>{(addProgress.isError || progressPhotoError) && <p className="mutation-error">{progressPhotoError || "Your note didn't stick this time. Please try again."}</p>}<div className="form-actions"><button type="button" className="button button-quiet" onClick={() => { setShowProgress(false); setProgressPhoto(null); }} data-testid="button-cancel-progress">Cancel</button><button type="submit" className="button button-primary" disabled={addProgress.isPending} data-testid="button-save-progress">{addProgress.isPending ? 'Saving note…' : 'Save progress'} <ArrowRight size={15}/></button></div></form></Form>}
        {photoRemovalError && <p className="mutation-error" role="alert">{photoRemovalError}</p>}
        {project.progress.length ? <div className="timeline">{[...project.progress].sort((a,b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map((entry) => <article className="timeline-entry" key={entry.id} data-testid={`entry-progress-${entry.id}`}><span className="timeline-marker"><Feather size={13}/></span><div className="timeline-card loom-card"><div className="timeline-entry-top"><time>{new Intl.DateTimeFormat('en', { weekday: 'long', month: 'long', day: 'numeric' }).format(new Date(entry.createdAt))}</time><b>{entry.completionPercent}% complete</b></div><p>{entry.notes}</p>{entry.photoPath && <><img className="timeline-photo" src={`/api/projects/${projectId}/progress/${entry.id}/photo`} alt={`Progress photo for ${project.title}`} loading="lazy"/><button type="button" className="button button-quiet button-remove-progress-photo" onClick={() => deleteEntryPhoto(entry.id)} disabled={removingPhotoEntryId === entry.id} data-testid={`button-remove-progress-photo-${entry.id}`}>{removingPhotoEntryId === entry.id ? 'Removing photo…' : 'Remove photo'} <X size={14}/></button></>}<ProgressBar value={entry.completionPercent}/></div></article>)}</div> : <div className="journal-empty"><span className="journal-empty-icon"><Feather size={20}/></span><h3>The first stitch in your journal</h3><p>When you've spent a little time with this project, leave yourself a note here.</p><button className="button button-outline" onClick={() => setShowProgress(true)} data-testid="button-first-progress">Add your first note <ArrowRight size={15}/></button></div>}
      </div>
      <aside className="detail-aside">
        <div className="aside-card loom-card"><span className="eyebrow">A FEW DETAILS</span><h3 className="serif">On the table</h3><dl className="detail-list">
          <div><dt>Pattern</dt><dd>{project.patternName || 'Not added yet'}</dd></div><div><dt>Designer</dt><dd>{project.patternDesigner || 'Not added yet'}</dd></div><div><dt>Yarn</dt><dd>{project.yarn || 'Not added yet'}</dd></div><div><dt>Tools</dt><dd>{project.tools || 'Not added yet'}</dd></div><div><dt>Target date</dt><dd>{project.targetDate ? new Intl.DateTimeFormat('en', { month: 'long', day: 'numeric', year: 'numeric' }).format(new Date(project.targetDate)) : 'No date in mind'}</dd></div>
        </dl>{project.description && <div className="personal-note"><span>NOTE TO SELF</span><p>{project.description}</p></div>}<button className="aside-edit" onClick={() => setEditing(!editing)} data-testid="button-edit-details"><Feather size={14}/> Edit details</button></div>
        <div className="aside-encouragement"><Flower2 className="encouragement-mark" size={48} strokeWidth={1}/><p>“Slow work is still<br/>beautiful work.”</p><span>YOUR WORKROOM, YOUR PACE</span></div>
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
