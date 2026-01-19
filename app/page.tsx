'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowRight, BookOpen, Target, Zap, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import AnimatedBackground from '@/components/AnimatedBackground';
import StructuredData from '@/components/StructuredData';
import LoadingScreen from '@/components/LoadingScreen';

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
      title: 'Learn Vocabulary',
      description: 'Master English vocabulary through interactive lessons and adaptive practice.',
    },
    {
      icon: Target,
      title: 'Smart Repetition',
      description: 'Spaced repetition algorithm ensures optimal retention and recall.',
    },
    {
      icon: Zap,
      title: 'Earn XP',
      description: 'Gain experience points and build your learning streak every day.',
    },
    {
      icon: TrendingUp,
      title: 'Track Progress',
      description: 'Monitor your improvement with detailed statistics and achievements.',
    },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground overflow-x-hidden">
      <StructuredData />
      <AnimatedBackground />
      <div className="relative z-10">
        <Navbar />
      
      {/* Hero Section */}
      <section className="pt-40 pb-12 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-center max-w-3xl mx-auto mb-16"
          >
            <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
              Master English Vocabulary
              <br />
              <span className="text-primary-yellow">The Smart Way</span>
            </h1>
            <p className="text-foreground/70 text-lg md:text-xl mb-8">
              Learn and master English vocabulary through gamification, spaced repetition, and adaptive learning. 
              Start your journey today!
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <button className="w-full sm:w-auto px-8 py-4 bg-primary-yellow text-black font-semibold rounded-lg hover:bg-primary-yellow-hover transition-colors flex items-center justify-center gap-2 cursor-pointer">
                  Get Started
                  <ArrowRight className="w-5 h-5" />
                </button>
              </Link>
              <Link href="/login">
                <button className="w-full sm:w-auto px-8 py-4 bg-card border border-theme rounded-lg hover:bg-card/80 transition-colors font-semibold cursor-pointer">
                  Sign In
                </button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Why Choose <span className="text-primary-yellow">Ryurex Edu?</span>
            </h2>
            <p className="text-foreground/70 text-lg max-w-2xl mx-auto">
              Powerful features designed to accelerate your English vocabulary learning
            </p>
          </motion.div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6, delay: index * 0.1 }}
                className="p-6 bg-card rounded-xl border border-theme hover:border-primary-yellow/50 transition-colors"
              >
                <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-yellow rounded-lg mb-4">
                  <feature.icon className="w-6 h-6 text-black" />
                </div>
                <h3 className="text-lg font-bold mb-2">{feature.title}</h3>
                <p className="text-foreground/70 text-sm">{feature.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Wave Divider 2 */}
      <div className="overflow-hidden bg-card/50">
        <svg className="w-full h-auto" viewBox="0 0 1200 120" preserveAspectRatio="none">
          <path d="M0,64L100,69.3C200,75,400,85,600,80C800,75,1000,53,1100,48L1200,42L1200,120L1100,120C1000,120,800,120,600,120C400,120,200,120,100,120L0,120Z" fill="var(--primary-yellow)" fillOpacity="1"></path>
        </svg>
      </div>

      {/* Stats Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-primary-yellow">
        <div className="max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="grid grid-cols-1 md:grid-cols-3 gap-8"
          >
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-black mb-2">1000+</div>
              <p className="text-black/70">Vocabulary Words</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-black mb-2">Adaptive</div>
              <p className="text-black/70">Learning Algorithm</p>
            </div>
            <div className="text-center">
              <div className="text-4xl md:text-5xl font-bold text-black mb-2">Gamified</div>
              <p className="text-black/70">Learning Experience</p>
            </div>
          </motion.div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 px-4 sm:px-6 lg:px-8 bg-card/50">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-4xl md:text-5xl font-bold mb-4">
              Ready to Level Up Your English?
            </h2>
            <p className="text-foreground/70 text-lg mb-8 max-w-2xl mx-auto">
              Join thousands of learners mastering English vocabulary with Ryurex Edu. 
              Start learning today and see the difference!
            </p>
            <Link href="/signup">
              <button className="px-8 py-4 bg-primary-yellow text-black font-semibold rounded-lg hover:bg-primary-yellow-hover transition-colors flex items-center justify-center gap-2 cursor-pointer mx-auto">
                Start Learning Now
                <ArrowRight className="w-5 h-5" />
              </button>
            </Link>
          </motion.div>
        </div>
      </section>

      <Footer />
      </div>
    </div>
  );
}

