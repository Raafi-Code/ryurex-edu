'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion, useInView } from 'framer-motion';
import {
  ArrowRight,
  BookOpen,
  Target,
  Zap,
  TrendingUp,
  Sparkles,
  Brain,
  Gamepad2,
  ChevronRight,
  GraduationCap,
  Users,
  Star,
} from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import StructuredData from '@/components/StructuredData';
import LoadingScreen from '@/components/LoadingScreen';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

// Animated counter hook
function useCounter(end: number, duration: number = 2000) {
  const [count, setCount] = useState(0);
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    let startTime: number;
    const animate = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const progress = Math.min((timestamp - startTime) / duration, 1);
      setCount(Math.floor(progress * end));
      if (progress < 1) requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  }, [isInView, end, duration]);

  return { count, ref };
}

// Separate component so useCounter hook is called at top level (Rules of Hooks)
function StatItem({ end, suffix, label }: { end: number; suffix: string; label: string }) {
  const counter = useCounter(end);
  return (
    <div ref={counter.ref} className="text-center">
      <div className="text-4xl sm:text-5xl font-bold text-primary-yellow mb-2">
        {counter.count}{suffix}
      </div>
      <p className="text-muted-foreground text-sm sm:text-base">{label}</p>
    </div>
  );
}

export default function Home() {
  const [checkingAuth, setCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          router.push('/dashboard');
        }
      } catch (error) {
        console.error('Auth check error:', error);
      } finally {
        setCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router, supabase]);

  if (checkingAuth) {
    return <LoadingScreen title="Checking authentication..." />;
  }

  const features = [
    {
      icon: BookOpen,
      title: 'Interactive Lessons',
      description: 'Master English vocabulary through engaging, interactive lessons designed to keep you motivated.',
      gradient: 'from-yellow-500/20 to-amber-500/20',
    },
    {
      icon: Brain,
      title: 'Smart Repetition',
      description: 'Our spaced repetition algorithm optimizes your retention and ensures lasting memory.',
      gradient: 'from-purple-500/20 to-violet-500/20',
    },
    {
      icon: Gamepad2,
      title: 'Gamified XP System',
      description: 'Earn experience points, build streaks, and level up as you learn new words every day.',
      gradient: 'from-emerald-500/20 to-teal-500/20',
    },
    {
      icon: TrendingUp,
      title: 'Progress Analytics',
      description: 'Track your improvement with detailed statistics, charts, and achievement milestones.',
      gradient: 'from-sky-500/20 to-blue-500/20',
    },
  ];

  const steps = [
    {
      number: '01',
      title: 'Create Your Account',
      description: 'Sign up in seconds and personalize your learning experience.',
      icon: Users,
    },
    {
      number: '02',
      title: 'Start Learning',
      description: 'Dive into vocabulary lessons with our adaptive learning engine.',
      icon: GraduationCap,
    },
    {
      number: '03',
      title: 'Track & Improve',
      description: 'Monitor progress, earn XP, and build daily learning streaks.',
      icon: Star,
    },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1 },
    },
  };

  const itemVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.5 } },
  };

  const stats = [
    { label: 'Vocabulary Words', end: 1000, suffix: '+' },
    { label: 'Active Learners', end: 500, suffix: '+' },
    { label: 'Daily Lessons', end: 50, suffix: '+' },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <StructuredData />
      <AnimatedBackground />
      <div className="relative z-10">
        <Navbar />

        {/* Hero Section */}
        <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
          {/* Floating decorative elements */}
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary-yellow/5 rounded-full blur-3xl animate-pulse" />
          <div className="absolute bottom-10 right-10 w-96 h-96 bg-secondary-purple/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />

          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7, ease: 'easeOut' }}
              className="text-center max-w-4xl mx-auto"
            >
              <Badge variant="outline" className="mb-6 px-4 py-1.5 text-sm border-primary-yellow/30 text-primary-yellow bg-primary-yellow/5">
                <Sparkles className="w-3.5 h-3.5 mr-1.5" />
                AI-Powered Vocabulary Learning
              </Badge>

              <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold mb-6 leading-tight tracking-tight">
                Master English
                <br />
                <span className="relative">
                  <span className="text-primary-yellow">Vocabulary</span>
                  <motion.span
                    className="absolute -bottom-2 left-0 w-full h-1 bg-primary-yellow/50 rounded-full"
                    initial={{ scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ delay: 0.8, duration: 0.6 }}
                  />
                </span>
                {' '}The Smart Way
              </h1>

              <p className="text-muted-foreground text-base sm:text-lg md:text-xl mb-10 max-w-2xl mx-auto leading-relaxed">
                Learn and master English vocabulary through gamification, spaced repetition, and adaptive AI. 
                Build your skills one word at a time.
              </p>

              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup">
                  <Button size="lg" className="px-8 py-6 text-base font-semibold rounded-xl bg-primary-yellow text-black hover:bg-primary-yellow-hover cursor-pointer group">
                    Get Started Free
                    <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button variant="outline" size="lg" className="px-8 py-6 text-base font-semibold rounded-xl border-border hover:border-primary-yellow/50 cursor-pointer">
                    Sign In
                    <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Floating glass cards */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.7 }}
              className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto"
            >
              {[
                { icon: Target, label: 'Adaptive Learning', value: 'AI-Powered' },
                { icon: Zap, label: 'Daily Streaks', value: 'XP System' },
                { icon: BookOpen, label: 'Word Library', value: '1000+ Words' },
              ].map((item, i) => (
                <motion.div
                  key={i}
                  whileHover={{ y: -4, scale: 1.02 }}
                  transition={{ type: 'spring', stiffness: 300 }}
                  className="glass rounded-xl p-4 text-center"
                >
                  <item.icon className="w-6 h-6 text-primary-yellow mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">{item.label}</p>
                  <p className="text-sm font-semibold">{item.value}</p>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        <Separator className="opacity-20" />

        {/* Features Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 px-3 py-1 text-xs border-primary-yellow/30 text-primary-yellow bg-primary-yellow/5">
                Features
              </Badge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Why Choose <span className="text-primary-yellow">RyuLearn?</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
                Powerful features designed to accelerate your English vocabulary learning journey
              </p>
            </motion.div>

            <motion.div
              variants={containerVariants}
              initial="hidden"
              whileInView="visible"
              viewport={{ once: true }}
              className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6"
            >
              {features.map((feature, index) => (
                <motion.div key={index} variants={itemVariants}>
                  <Card className="group h-full border-border/50 bg-card/50 backdrop-blur-sm hover:border-primary-yellow/40 transition-all duration-300 hover:shadow-lg hover:shadow-primary-yellow/5 cursor-default">
                    <CardContent className="p-6 pt-6">
                      <div className={`inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} mb-5 group-hover:scale-110 transition-transform duration-300`}>
                        <feature.icon className="w-6 h-6 text-primary-yellow" />
                      </div>
                      <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-card/30">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="text-center mb-16"
            >
              <Badge variant="outline" className="mb-4 px-3 py-1 text-xs border-primary-yellow/30 text-primary-yellow bg-primary-yellow/5">
                How It Works
              </Badge>
              <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                Start Learning in <span className="text-primary-yellow">3 Simple Steps</span>
              </h2>
              <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto">
                Getting started is easy. Create your account and begin mastering vocabulary today.
              </p>
            </motion.div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative">
              {/* Connecting line for desktop */}
              <div className="hidden md:block absolute top-16 left-[16%] right-[16%] h-0.5 bg-gradient-to-r from-primary-yellow/30 via-primary-yellow/60 to-primary-yellow/30" />
              
              {steps.map((step, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: index * 0.15 }}
                  className="relative text-center"
                >
                  <div className="relative z-10 inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-yellow text-black text-xl font-bold mb-6 shadow-lg shadow-primary-yellow/20">
                    {step.number}
                  </div>
                  <div className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-yellow/10 mb-3">
                    <step.icon className="w-5 h-5 text-primary-yellow" />
                  </div>
                  <h3 className="text-xl font-bold mb-2">{step.title}</h3>
                  <p className="text-muted-foreground text-sm max-w-xs mx-auto">{step.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Stats Section */}
        <section className="py-16 px-4 sm:px-6 lg:px-8">
          <div className="max-w-5xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="rounded-2xl bg-gradient-to-r from-primary-yellow via-amber-400 to-primary-yellow p-[1px]"
            >
              <div className="rounded-2xl bg-background/95 backdrop-blur-sm p-8 sm:p-12">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
                  <StatItem end={stats[0].end} suffix={stats[0].suffix} label={stats[0].label} />
                  <StatItem end={stats[1].end} suffix={stats[1].suffix} label={stats[1].label} />
                  <StatItem end={stats[2].end} suffix={stats[2].suffix} label={stats[2].label} />
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mx-auto text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6 }}
              className="relative"
            >
              {/* Glow effect */}
              <div className="absolute inset-0 -m-8 bg-primary-yellow/5 rounded-3xl blur-2xl" />

              <div className="relative glass rounded-2xl p-8 sm:p-12 md:p-16">
                <Badge variant="outline" className="mb-6 px-3 py-1 text-xs border-primary-yellow/30 text-primary-yellow bg-primary-yellow/5">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Free to Start
                </Badge>

                <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
                  Ready to Level Up
                  <br />
                  <span className="text-primary-yellow">Your English?</span>
                </h2>
                <p className="text-muted-foreground text-base sm:text-lg mb-8 max-w-2xl mx-auto">
                  Join learners mastering English vocabulary with RyuLearn. 
                  Start learning today and see the difference!
                </p>

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                  <Link href="/signup">
                    <Button size="lg" className="px-10 py-6 text-base font-semibold rounded-xl bg-primary-yellow text-black hover:bg-primary-yellow-hover cursor-pointer group shadow-lg shadow-primary-yellow/20">
                      Start Learning Now
                      <ArrowRight className="w-5 h-5 ml-1 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button variant="ghost" size="lg" className="px-6 py-6 text-base cursor-pointer text-muted-foreground hover:text-foreground">
                      Already have an account?
                    </Button>
                  </Link>
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        <Footer />
      </div>
    </div>
  );
}
