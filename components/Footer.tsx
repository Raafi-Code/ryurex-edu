'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

interface FooterProps {
  fullContent?: boolean;
}

export default function Footer({ fullContent = false }: FooterProps) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative bg-card border-t border-theme w-full">
      <div className={`px-4 sm:px-6 lg:px-8 ${fullContent ? 'py-12 md:py-16' : 'py-6'}`}>
        {/* Main Footer Content */}
        <div className="max-w-6xl mx-auto">
          {fullContent && (
            <>
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="flex flex-col items-center justify-center text-center mb-12"
              >
                {/* Logo and Company Info Section */}
                <div className="flex items-center justify-center space-x-2 mb-4">
                  <Image
                    src="/favicon.svg"
                    alt="Ryurex Edu Logo"
                    width={40}
                    height={40}
                    className="w-10 h-10"
                  />
                  <h3 className="text-heading-3 text-primary-yellow">Ryurex Edu</h3>
                </div>
                <p className="text-foreground/70 text-body-lg leading-relaxed max-w-2xl">
                  Level up your English vocabulary with gamification and spaced repetition. Learn smarter, not harder. Our adaptive learning system adjusts to your pace and learning style, making vocabulary acquisition engaging and effective. Join thousands of learners mastering English vocabulary today.
                </p>
              </motion.div>

              {/* Divider */}
              <div className="h-px bg-theme opacity-30 mb-8" />
            </>
          )}

          {/* Bottom Section */}
          <motion.div
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.4 }}
            className="text-center"
          >
            {/* Copyright */}
            <div className="text-foreground/60 text-label">
              © {currentYear} Ryurex Edu. All rights reserved.
            </div>
          </motion.div>
        </div>
      </div>
    </footer>
  );
}
