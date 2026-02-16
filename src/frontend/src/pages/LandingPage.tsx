import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { toast } from 'sonner';
import { motion, AnimatePresence, useInView } from 'framer-motion';
import {
  Zap, Lock, Upload, Cpu, ArrowRight,
  Brain, Users, MessageSquare, Shield, BarChart3,
  ChevronDown, CheckCircle2, Globe, Layers, Eye,
  Network, Target, Star, Menu, X, Check, Minus,
  ChevronRight, Moon, Sun
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { type Lang, translations } from '@/i18n/landing-translations';
import PlatformShowcase from '@/components/landing/PlatformShowcase';

type AuthTab = 'login' | 'register' | 'forgot';

interface LandingPageProps {
  onEnter: () => void;
}

const fadeInUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number = 0) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.6, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] as const },
  }),
};

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.08 } },
};

const scaleIn = {
  hidden: { opacity: 0, scale: 0.9 },
  visible: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: [0.22, 1, 0.36, 1] as const } },
};

const GlowOrb = ({ className }: { className?: string }) => (
  <div className={`absolute rounded-full blur-[120px] pointer-events-none ${className}`} />
);

/* ── Animated Counter ── */
const AnimatedCounter = ({ value, suffix = '' }: { value: string; suffix?: string }) => {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const numericPart = parseInt(value.replace(/[^0-9]/g, ''));
  const prefix = value.replace(/[0-9]/g, '').replace(suffix, '');
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isInView || isNaN(numericPart)) return;
    const duration = 1500;
    const steps = 40;
    const increment = numericPart / steps;
    let current = 0;
    const timer = setInterval(() => {
      current += increment;
      if (current >= numericPart) {
        setCount(numericPart);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, duration / steps);
    return () => clearInterval(timer);
  }, [isInView, numericPart]);

  if (isNaN(numericPart)) {
    return <span ref={ref}>{value}</span>;
  }

  return <span ref={ref}>{prefix}{isInView ? count : 0}{suffix}</span>;
};


/* ── Feature Icons ── */
const featureIcons = [Brain, Network, Users, MessageSquare, Target, BarChart3];
const featureGradients = [
  'from-[hsl(200,100%,55%)] to-[hsl(220,80%,60%)]',
  'from-[hsl(165,80%,45%)] to-[hsl(200,100%,55%)]',
  'from-[hsl(280,80%,55%)] to-[hsl(320,70%,55%)]',
  'from-[hsl(38,92%,55%)] to-[hsl(15,80%,55%)]',
  'from-[hsl(0,72%,55%)] to-[hsl(330,70%,50%)]',
  'from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)]',
];

const stepIcons = [Upload, Cpu, Layers, Eye];

const integrationLogos = [
  { name: 'Zoom', icon: '🎥' },
  { name: 'Google Meet', icon: '📹' },
  { name: 'Microsoft Teams', icon: '💬' },
  { name: 'Slack', icon: '💭' },
  { name: 'Gmail', icon: '📧' },
  { name: 'Google Drive', icon: '📁' },
  { name: 'Notion', icon: '📝' },
  { name: 'Confluence', icon: '📚' },
  { name: 'Jira', icon: '🎯' },
  { name: 'OneDrive', icon: '☁️' },
  { name: 'Outlook', icon: '📨' },
  { name: 'Dropbox', icon: '📦' },
];

const langFlags: Record<Lang, string> = { pt: '🇵🇹', en: '🇬🇧', es: '🇪🇸' };
const langLabels: Record<Lang, string> = { pt: 'PT', en: 'EN', es: 'ES' };

/* ═══════════════════════════════════════════════ */
/* ██ MAIN COMPONENT                              */
/* ═══════════════════════════════════════════════ */
const LandingPage = ({ onEnter }: LandingPageProps) => {
  const [lang, setLang] = useState<Lang>('pt');
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [authTab, setAuthTab] = useState<AuthTab>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeFaq, setActiveFaq] = useState<number | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      return document.documentElement.classList.contains('dark');
    }
    return true;
  });

  const t = translations[lang];

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDark]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (authTab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password
        });
        if (error) throw error;
        // The onAuthStateChange listener in App.tsx will handle the redirect
        // But we call onEnter just in case the parent relies on it for animation/state
        onEnter();
      } else if (authTab === 'register') {
        if (password !== confirmPassword) {
          toast.error(t.auth.passwordMismatch || "Passwords do not match");
          setLoading(false);
          return;
        }
        const { error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) throw error;
        toast.success("Registration successful! Please check your email.");
        if (authTab === 'register') setAuthTab('login');
      } else if (authTab === 'forgot') {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin + '/reset-password',
        });
        if (error) throw error;
        toast.success("If an account exists, a password reset email has been sent.");
        setAuthTab('login');
      }
    } catch (error: any) {
      console.error('Auth error:', error);
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const scrollToAuth = (tab: AuthTab) => {
    setAuthTab(tab);
    document.getElementById('auth-section')?.scrollIntoView({ behavior: 'smooth' });
  };

  const navLinks = [
    { label: t.nav.features, href: '#funcionalidades' },
    { label: t.nav.howItWorks, href: '#como-funciona' },
    { label: t.nav.pricing, href: '#pricing' },
    { label: t.nav.security, href: '#seguranca' },
    { label: t.nav.faq, href: '#faq' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <GlowOrb className="w-[600px] h-[600px] bg-primary/10 top-[-200px] left-[-200px]" />
      <GlowOrb className="w-[500px] h-[500px] bg-accent/10 top-[200px] right-[-150px]" />
      <GlowOrb className="w-[400px] h-[400px] bg-[hsl(280,80%,55%/0.05)] bottom-[400px] left-[20%]" />

      {/* ═══ NAVBAR ═══ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'bg-background/85 backdrop-blur-xl border-b border-border/50' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-6 md:px-12 flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center shadow-lg shadow-primary/30">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight">GodMode</span>
          </div>

          <div className="hidden lg:flex items-center gap-8 text-sm text-muted-foreground">
            {navLinks.map((link) => (
              <a key={link.href} href={link.href} className="hover:text-foreground transition-colors duration-200">
                {link.label}
              </a>
            ))}
          </div>

          <div className="hidden lg:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              onClick={() => setIsDark(!isDark)}
              className="w-9 h-9 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              title="Toggle theme"
            >
              {isDark ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>

            {/* Language Switcher */}
            <div className="relative">
              <button
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
              >
                <span>{langFlags[lang]}</span>
                <span className="text-xs font-medium">{langLabels[lang]}</span>
                <ChevronDown className="w-3 h-3" />
              </button>
              <AnimatePresence>
                {langMenuOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute top-full right-0 mt-1 bg-card border border-border rounded-lg shadow-xl overflow-hidden min-w-[100px]"
                  >
                    {(['pt', 'en', 'es'] as Lang[]).map((l) => (
                      <button
                        key={l}
                        onClick={() => { setLang(l); setLangMenuOpen(false); }}
                        className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-secondary transition-colors ${lang === l ? 'text-primary' : 'text-muted-foreground'}`}
                      >
                        <span>{langFlags[l]}</span>
                        <span>{langLabels[l]}</span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground hover:bg-secondary" onClick={() => scrollToAuth('login')}>
              {t.nav.login}
            </Button>
            <Button size="sm" className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] hover:from-[hsl(200,100%,50%)] hover:to-[hsl(165,80%,40%)] text-white font-semibold shadow-lg shadow-primary/25 border-0" onClick={() => scrollToAuth('register')}>
              {t.nav.getStarted}
            </Button>
          </div>

          <button className="lg:hidden text-foreground" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>

        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="lg:hidden bg-background/95 backdrop-blur-xl border-b border-border">
              <div className="px-6 py-4 flex flex-col gap-3">
                {navLinks.map((link) => (
                  <a key={link.href} href={link.href} className="text-muted-foreground hover:text-foreground py-2" onClick={() => setMobileMenuOpen(false)}>
                    {link.label}
                  </a>
                ))}
                {/* Mobile theme + language */}
                <div className="flex gap-2 py-2 items-center">
                  <button
                    onClick={() => setIsDark(!isDark)}
                    className="px-3 py-1.5 rounded-lg text-xs font-medium border border-border text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {isDark ? '🌙' : '☀️'}
                  </button>
                  {(['pt', 'en', 'es'] as Lang[]).map((l) => (
                    <button key={l} onClick={() => { setLang(l); }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${lang === l ? 'bg-primary/15 text-primary border border-primary/30' : 'text-muted-foreground border border-border'}`}
                    >
                      {langFlags[l]} {langLabels[l]}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" size="sm" className="flex-1 border-border" onClick={() => { scrollToAuth('login'); setMobileMenuOpen(false); }}>
                    {t.nav.login}
                  </Button>
                  <Button size="sm" className="flex-1 bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] text-white border-0" onClick={() => { scrollToAuth('register'); setMobileMenuOpen(false); }}>
                    {t.nav.start}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* ═══ HERO ═══ */}
      <section id="auth-section" className="relative pt-32 pb-20 px-6 md:px-12">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
          <motion.div className="flex-1 max-w-2xl" initial="hidden" animate="visible" variants={staggerContainer}>
            <motion.div variants={fadeInUp} custom={0} className="mb-6">
              <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                {t.hero.badge}
              </span>
            </motion.div>

            <motion.h1 variants={fadeInUp} custom={1} className="text-4xl sm:text-5xl lg:text-6xl font-bold leading-[1.1] mb-6 tracking-tight">
              {t.hero.titlePart1}{' '}
              <span className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">
                {t.hero.titleHighlight}
              </span>
            </motion.h1>

            <motion.p variants={fadeInUp} custom={2} className="text-lg text-muted-foreground mb-8 leading-relaxed max-w-lg">
              {t.hero.subtitle}
            </motion.p>

            <motion.div variants={fadeInUp} custom={3} className="flex flex-wrap items-center gap-6 text-sm text-muted-foreground mb-10">
              <span className="flex items-center gap-2"><Zap className="w-4 h-4 text-warning" />{t.hero.fastProcessing}</span>
              <span className="flex items-center gap-2"><Globe className="w-4 h-4 text-primary" />{t.hero.multiProvider}</span>
              <span className="flex items-center gap-2"><Lock className="w-4 h-4 text-accent" />{t.hero.rgpd}</span>
            </motion.div>

            <motion.div variants={fadeInUp} custom={4} className="flex flex-wrap items-center gap-4">
              <Button size="lg" className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] hover:from-[hsl(200,100%,50%)] hover:to-[hsl(165,80%,40%)] text-white font-semibold shadow-xl shadow-primary/25 border-0 px-8" onClick={() => scrollToAuth('register')}>
                {t.hero.ctaPrimary} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
              <Button size="lg" variant="outline" className="border-border text-foreground hover:bg-secondary" onClick={() => document.getElementById('funcionalidades')?.scrollIntoView({ behavior: 'smooth' })}>
                {t.hero.ctaSecondary}
              </Button>
            </motion.div>
          </motion.div>

          {/* Auth Card */}
          <motion.div initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.7, delay: 0.3, ease: [0.22, 1, 0.36, 1] as const }} className="w-full lg:w-[420px] shrink-0">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-2xl blur-xl" />
              <div className="relative bg-card rounded-2xl border border-border p-7 shadow-2xl">
                {authTab !== 'forgot' && (
                  <div className="flex mb-7 bg-muted rounded-xl p-1">
                    {(['login', 'register'] as const).map((tab) => (
                      <button key={tab} onClick={() => setAuthTab(tab)}
                        className={`flex-1 py-2.5 text-sm font-semibold rounded-lg transition-all duration-300 ${authTab === tab ? 'bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] text-white shadow-lg' : 'text-muted-foreground hover:text-foreground'}`}>
                        {tab === 'login' ? t.auth.login : t.auth.register}
                      </button>
                    ))}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                  {authTab === 'forgot' && <p className="text-sm text-muted-foreground mb-2">{t.auth.forgotDesc}</p>}

                  <div className="space-y-1.5">
                    <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{t.auth.email}</Label>
                    <Input type="email" placeholder={t.auth.emailPlaceholder} value={email} onChange={(e) => setEmail(e.target.value)}
                      className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50 h-11 rounded-xl focus:border-primary focus:ring-primary/20 transition-all" />
                  </div>

                  {authTab !== 'forgot' && (
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{t.auth.password}</Label>
                      <Input type="password" placeholder={authTab === 'register' ? t.auth.passwordMinHint : t.auth.passwordPlaceholder} value={password} onChange={(e) => setPassword(e.target.value)}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50 h-11 rounded-xl focus:border-primary focus:ring-primary/20 transition-all" />
                      {authTab === 'register' && <p className="text-xs text-muted-foreground/70">{t.auth.passwordHint}</p>}
                    </div>
                  )}

                  {authTab === 'register' && (
                    <div className="space-y-1.5">
                      <Label className="text-muted-foreground text-xs font-medium uppercase tracking-wider">{t.auth.confirmPassword}</Label>
                      <Input type="password" placeholder={t.auth.confirmPlaceholder} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-muted border-border text-foreground placeholder:text-muted-foreground/50 h-11 rounded-xl focus:border-primary focus:ring-primary/20 transition-all" />
                    </div>
                  )}

                  <Button type="submit" disabled={loading}
                    className="w-full h-11 bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] hover:from-[hsl(200,100%,50%)] hover:to-[hsl(165,80%,40%)] text-white font-semibold rounded-xl shadow-lg shadow-primary/25 border-0 transition-all">
                    {loading
                      ? t.auth.loading[authTab]
                      : authTab === 'forgot' ? t.auth.sendLink : authTab === 'login' ? t.auth.login : t.auth.register
                    }
                  </Button>

                  {/* Social login */}
                  {authTab !== 'forgot' && (
                    <>
                      <div className="relative my-4">
                        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                          <span className="bg-card px-3 text-muted-foreground/60">{t.auth.orContinueWith}</span>
                        </div>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {['Google', 'GitHub', 'Microsoft'].map((provider) => (
                          <button key={provider} type="button"
                            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-border bg-muted text-muted-foreground text-xs font-medium hover:bg-secondary hover:border-border/80 transition-all">
                            {provider}
                          </button>
                        ))}
                      </div>
                    </>
                  )}

                  {authTab === 'register' && (
                    <p className="text-[10px] text-muted-foreground/60 text-center mt-3">
                      {t.auth.termsAgree} <a href="#" className="text-primary hover:underline">{t.auth.terms}</a> {t.auth.and} <a href="#" className="text-primary hover:underline">{t.auth.privacy}</a>.
                    </p>
                  )}

                  <div className="text-center pt-1">
                    {authTab === 'login' && (
                      <button type="button" onClick={() => setAuthTab('forgot')} className="text-xs text-primary hover:text-primary/80 transition-colors">{t.auth.forgotPassword}</button>
                    )}
                    {authTab === 'forgot' && (
                      <button type="button" onClick={() => setAuthTab('login')} className="text-xs text-primary hover:text-primary/80 transition-colors">{t.auth.backToLogin}</button>
                    )}
                  </div>
                </form>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ═══ STATS BAR ═══ */}
      <section className="relative px-6 md:px-12 py-12">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {t.stats.map((stat, i) => (
              <motion.div key={i} variants={fadeInUp} custom={i} className="text-center p-6 rounded-2xl bg-card/50 border border-border/50">
                <div className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">
                  <AnimatedCounter value={stat.value} suffix={stat.value.includes('%') ? '%' : stat.value.includes('+') ? '+' : ''} />
                </div>
                <div className="text-sm text-muted-foreground mt-1">{stat.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ TRUSTED BY (logos) ═══ */}
      <section className="relative px-6 md:px-12 py-8">
        <div className="max-w-7xl mx-auto">
          <motion.p initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} className="text-center text-xs uppercase tracking-widest text-muted-foreground/50 mb-6">
            {t.trustedBy}
          </motion.p>
          <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 0.4 }} viewport={{ once: true }} className="flex flex-wrap justify-center gap-8 md:gap-12">
            {['TechScale', 'DataFlow', 'InnovatePT', 'CloudPT', 'NovaTech', 'Byte.ai'].map((name) => (
              <span key={name} className="text-lg font-bold tracking-tight text-muted-foreground/40">{name}</span>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ FEATURES ═══ */}
      <section id="funcionalidades" className="relative px-6 md:px-12 py-24">
        <GlowOrb className="w-[500px] h-[500px] bg-accent/5 top-0 right-[-100px]" />
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-primary">{t.features.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mt-3 mb-4">
              {t.features.title}{' '}<span className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">{t.features.titleHighlight}</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.features.subtitle}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {t.features.items.map((feature, i) => {
              const Icon = featureIcons[i];
              return (
                <motion.div key={i} variants={fadeInUp} custom={i}
                  className="group relative p-7 rounded-2xl bg-card/60 border border-border hover:border-border/80 transition-all duration-500 hover:shadow-xl hover:shadow-primary/5">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${featureGradients[i]} flex items-center justify-center mb-5 shadow-lg group-hover:scale-110 transition-transform duration-300`}>
                    <Icon className="w-6 h-6 text-white" />
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">{feature.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ PLATFORM SHOWCASE ═══ */}
      <PlatformShowcase lang={lang} />

      {/* ═══ HOW IT WORKS ═══ */}
      <section id="como-funciona" className="relative px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-accent">{t.howItWorks.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mt-3 mb-4">
              {t.howItWorks.title}{' '}<span className="bg-gradient-to-r from-[hsl(165,80%,45%)] to-[hsl(200,100%,55%)] bg-clip-text text-transparent">{t.howItWorks.titleHighlight}</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.howItWorks.subtitle}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {t.howItWorks.steps.map((step, i) => {
              const Icon = stepIcons[i];
              return (
                <motion.div key={i} variants={fadeInUp} custom={i} className="relative text-center">
                  {i < 3 && <div className="hidden lg:block absolute top-10 left-[60%] w-[80%] h-px bg-gradient-to-r from-primary/30 to-transparent" />}
                  <div className="relative inline-flex mb-5">
                    <div className="w-20 h-20 rounded-2xl bg-card border border-border flex items-center justify-center">
                      <Icon className="w-8 h-8 text-primary" />
                    </div>
                    <span className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] text-white text-xs font-bold flex items-center justify-center shadow-lg">{i + 1}</span>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed max-w-[250px] mx-auto">{step.desc}</p>
                </motion.div>
              );
            })}
          </motion.div>
        </div>
      </section>

      {/* ═══ INTEGRATIONS ═══ */}
      <section className="relative px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-[hsl(280,80%,55%)]">{t.integrations.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mt-3 mb-4">
              {t.integrations.title}{' '}<span className="bg-gradient-to-r from-[hsl(280,80%,55%)] to-[hsl(200,100%,55%)] bg-clip-text text-transparent">{t.integrations.titleHighlight}</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.integrations.subtitle}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-4">
            {integrationLogos.map((logo, i) => (
              <motion.div key={i} variants={fadeInUp} custom={i}
                className="flex flex-col items-center gap-2 p-5 rounded-2xl bg-card/40 border border-border hover:border-border/80 hover:bg-card/60 transition-all group">
                <span className="text-2xl group-hover:scale-110 transition-transform">{logo.icon}</span>
                <span className="text-[10px] text-muted-foreground font-medium">{logo.name}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ PRICING ═══ */}
      <section id="pricing" className="relative px-6 md:px-12 py-24">
        <GlowOrb className="w-[500px] h-[500px] bg-primary/5 bottom-0 left-[-100px]" />
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-primary">{t.pricing.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-5xl font-bold mt-3 mb-4">
              {t.pricing.title}{' '}<span className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">{t.pricing.titleHighlight}</span>
            </motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg max-w-2xl mx-auto">{t.pricing.subtitle}</motion.p>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {t.pricing.plans.map((plan, i) => (
              <motion.div key={i} variants={fadeInUp} custom={i}
                className={`relative rounded-2xl p-7 border transition-all ${plan.highlighted
                  ? 'bg-gradient-to-b from-card to-card/80 border-primary/30 shadow-xl shadow-primary/10'
                  : 'bg-card/60 border-border'}`}>
                {plan.highlighted && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="px-4 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] text-white">
                      {t.pricing.popular}
                    </span>
                  </div>
                )}
                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <div className="flex items-baseline gap-1 mb-2">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  {plan.price !== 'Custom' && plan.price !== 'Gratis' && plan.price !== 'Free' && plan.price !== 'Grátis' && (
                    <span className="text-sm text-muted-foreground">{t.pricing.monthly}</span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
                <ul className="space-y-3 mb-8">
                  {plan.features.map((f, j) => (
                    <li key={j} className="flex items-start gap-2 text-sm text-muted-foreground">
                      <Check className="w-4 h-4 text-accent shrink-0 mt-0.5" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button className={`w-full ${plan.highlighted
                  ? 'bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] text-white font-semibold shadow-lg shadow-primary/25 border-0'
                  : 'bg-secondary text-foreground border border-border hover:bg-secondary/80'}`}
                  onClick={() => scrollToAuth('register')}>
                  {plan.cta} <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ COMPARISON TABLE ═══ */}
      <section className="relative px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-12">
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold">
              {t.comparison.title}{' '}<span className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">{t.comparison.titleHighlight}</span>
            </motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn}
            className="rounded-2xl border border-border bg-card/60 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  {t.comparison.headers.map((h, i) => (
                    <th key={i} className={`p-4 text-left font-semibold ${i === 1 ? 'text-primary' : 'text-muted-foreground'} ${i === 0 ? 'w-[40%]' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.comparison.rows.map((row, i) => (
                  <tr key={i} className="border-b border-border/50 last:border-0">
                    <td className="p-4 text-muted-foreground">{row[0]}</td>
                    {[1, 2, 3].map((col) => (
                      <td key={col} className="p-4 text-center">
                        {typeof row[col] === 'boolean' ? (
                          row[col] ? <Check className="w-5 h-5 text-accent mx-auto" /> : <Minus className="w-5 h-5 text-muted-foreground/40 mx-auto" />
                        ) : (
                          <span className={`text-xs font-mono ${col === 1 ? 'text-primary' : 'text-muted-foreground'}`}>{row[col]}</span>
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </motion.div>
        </div>
      </section>

      {/* ═══ SECURITY ═══ */}
      <section id="seguranca" className="relative px-6 md:px-12 py-24">
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="flex flex-col lg:flex-row items-center gap-16">
            <motion.div variants={fadeInUp} className="flex-1">
              <span className="text-xs font-semibold uppercase tracking-widest text-success">{t.security.label}</span>
              <h2 className="text-3xl md:text-4xl font-bold mt-3 mb-6">
                {t.security.title}{' '}<span className="bg-gradient-to-r from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)] bg-clip-text text-transparent">{t.security.titleHighlight}</span>
              </h2>
              <div className="space-y-5">
                {t.security.items.map((text, i) => {
                  const icons = [Shield, Lock, Globe, CheckCircle2];
                  const Icon = icons[i];
                  return (
                    <motion.div key={i} variants={fadeInUp} custom={i} className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0 mt-0.5">
                        <Icon className="w-4 h-4 text-success" />
                      </div>
                      <span className="text-muted-foreground">{text}</span>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>

            <motion.div variants={scaleIn} className="flex-1 max-w-md w-full">
              <div className="relative">
                <div className="absolute -inset-4 bg-gradient-to-r from-success/10 to-accent/10 rounded-3xl blur-2xl" />
                <div className="relative bg-card rounded-2xl border border-border p-8 text-center">
                  <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-[hsl(142,70%,45%)] to-[hsl(165,80%,45%)] flex items-center justify-center mx-auto mb-6 shadow-xl shadow-success/20">
                    <Shield className="w-10 h-10 text-white" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{t.security.enterpriseTitle}</h3>
                  <p className="text-sm text-muted-foreground mb-6">{t.security.enterpriseDesc}</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    {t.security.badges.map((badge) => (
                      <span key={badge} className="px-3 py-1 text-xs font-medium rounded-full bg-success/10 text-success border border-success/20">{badge}</span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        </div>
      </section>

      {/* ═══ TESTIMONIALS ═══ */}
      <section className="relative px-6 md:px-12 py-24">
        <GlowOrb className="w-[400px] h-[400px] bg-[hsl(280,80%,55%/0.04)] top-0 left-[10%]" />
        <div className="max-w-7xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-warning">{t.testimonials.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mt-3">{t.testimonials.title}</motion.h2>
          </motion.div>

          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-50px' }} variants={staggerContainer} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {t.testimonials.items.map((testimonial, i) => (
              <motion.div key={i} variants={fadeInUp} custom={i}
                className="p-6 rounded-2xl bg-card/60 border border-border hover:border-border/80 transition-all">
                <div className="flex gap-1 mb-4">
                  {[...Array(5)].map((_, j) => (
                    <Star key={j} className="w-3.5 h-3.5 fill-warning text-warning" />
                  ))}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed mb-5 italic">"{testimonial.quote}"</p>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center text-xs font-bold text-white">
                    {testimonial.author.split(' ').map(n => n[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold">{testimonial.author}</div>
                    <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="relative px-6 md:px-12 py-24">
        <div className="max-w-4xl mx-auto">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-80px' }} variants={staggerContainer} className="text-center mb-16">
            <motion.span variants={fadeInUp} className="text-xs font-semibold uppercase tracking-widest text-primary">{t.faq.label}</motion.span>
            <motion.h2 variants={fadeInUp} className="text-3xl md:text-4xl font-bold mt-3">{t.faq.title}</motion.h2>
            <motion.p variants={fadeInUp} className="text-muted-foreground text-lg mt-3 max-w-2xl mx-auto">{t.faq.subtitle}</motion.p>
          </motion.div>

          <div className="space-y-10">
            {t.faq.sections.map((section, si) => (
              <motion.div key={si} initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-30px' }} variants={staggerContainer}>
                <motion.h3 variants={fadeInUp} className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <span>{section.category}</span>
                </motion.h3>
                <div className="space-y-2">
                  {section.items.map((faq, i) => {
                    const globalIndex = t.faq.sections.slice(0, si).reduce((sum, s) => sum + s.items.length, 0) + i;
                    return (
                      <motion.div key={i} variants={fadeInUp} custom={i} className="rounded-xl border border-border bg-card/40 overflow-hidden">
                        <button onClick={() => setActiveFaq(activeFaq === globalIndex ? null : globalIndex)}
                          className="w-full flex items-center justify-between p-5 text-left hover:bg-secondary/30 transition-colors">
                          <span className="text-sm font-medium pr-4">{faq.q}</span>
                          <ChevronDown className={`w-4 h-4 text-muted-foreground shrink-0 transition-transform duration-300 ${activeFaq === globalIndex ? 'rotate-180' : ''}`} />
                        </button>
                        <AnimatePresence>
                          {activeFaq === globalIndex && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3 }}>
                              <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">{faq.a}</div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA ═══ */}
      <section className="relative px-6 md:px-12 py-24">
        <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={scaleIn} className="max-w-4xl mx-auto">
          <div className="relative">
            <div className="absolute -inset-2 bg-gradient-to-r from-primary/15 to-accent/15 rounded-3xl blur-2xl" />
            <div className="relative rounded-3xl bg-card border border-border p-12 md:p-16 text-center">
              <h2 className="text-3xl md:text-4xl font-bold mb-4">{t.cta.title}</h2>
              <p className="text-muted-foreground text-lg mb-8 max-w-xl mx-auto">{t.cta.subtitle}</p>
              <Button size="lg" className="bg-gradient-to-r from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] hover:from-[hsl(200,100%,50%)] hover:to-[hsl(165,80%,40%)] text-white font-semibold shadow-xl shadow-primary/25 border-0 px-10"
                onClick={() => scrollToAuth('register')}>
                {t.cta.button} <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        </motion.div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="border-t border-border px-6 md:px-12 py-12">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-start gap-8 mb-10">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[hsl(200,100%,55%)] to-[hsl(165,80%,45%)] flex items-center justify-center">
                  <Zap className="w-4 h-4 text-white" />
                </div>
                <span className="text-lg font-bold">GodMode</span>
              </div>
              <p className="text-sm text-muted-foreground max-w-xs">{t.footer.desc}</p>
              {/* Footer language switcher */}
              <div className="flex gap-2 mt-4">
                {(['pt', 'en', 'es'] as Lang[]).map((l) => (
                  <button key={l} onClick={() => setLang(l)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${lang === l ? 'bg-primary/15 text-primary' : 'text-muted-foreground/60 hover:text-muted-foreground'}`}>
                    {langFlags[l]} {langLabels[l]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-12 text-sm">
              <div className="space-y-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{t.footer.product}</h4>
                <a href="#funcionalidades" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.nav.features}</a>
                <a href="#seguranca" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.security.label}</a>
                <a href="#pricing" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.pricing.label}</a>
                <a href="#faq" className="block text-muted-foreground/70 hover:text-foreground transition-colors">FAQ</a>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{t.footer.contact}</h4>
                <a href="#" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.footer.support}</a>
                <a href="#" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.footer.docs}</a>
                <a href="#" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.footer.blog}</a>
              </div>
              <div className="space-y-3">
                <h4 className="font-semibold text-xs uppercase tracking-wider text-muted-foreground">{t.footer.legal}</h4>
                <a href="#" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.footer.privacy}</a>
                <a href="#" className="block text-muted-foreground/70 hover:text-foreground transition-colors">{t.footer.terms}</a>
              </div>
            </div>
          </div>
          <div className="border-t border-border pt-6 text-center text-xs text-muted-foreground/60">
            © {new Date().getFullYear()} GodMode. {t.footer.rights}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
