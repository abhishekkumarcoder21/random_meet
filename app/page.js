'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

const ROOM_TYPES = [
  {
    icon: '💬',
    title: 'Quick Chat',
    desc: 'A genuine 5-minute conversation with a stranger. No pressure, just be yourself.',
    duration: '5 min',
    people: '2 people',
    tag: 'Free'
  },
  {
    icon: '🗣️',
    title: 'Group Prompt',
    desc: 'A small group discusses a thoughtful prompt together. Different perspectives, shared curiosity.',
    duration: '10 min',
    people: '4-6 people',
    tag: 'Free'
  },
  {
    icon: '🤫',
    title: 'Confession Room',
    desc: 'Share something anonymously. No judgement, no replies — just expression.',
    duration: '3 min',
    people: '1 writer + readers',
    tag: 'Free'
  },
  {
    icon: '🤝',
    title: 'Two Strangers, One Task',
    desc: 'Collaborate on a fun mini-task with someone you\'ve never met.',
    duration: '8 min',
    people: '2 people',
    tag: 'Premium'
  },
  {
    icon: '👂',
    title: 'Listening Circle',
    desc: 'One person shares, others listen and support with gentle reactions.',
    duration: '7 min',
    people: '3-5 people',
    tag: 'Premium'
  }
];

const STEPS = [
  { num: '01', title: 'Enter the Lobby', desc: 'Browse available rooms and find one that resonates with you.' },
  { num: '02', title: 'Join a Room', desc: 'Step into a structured, time-bound experience with real people.' },
  { num: '03', title: 'Participate', desc: 'Talk, listen, express, collaborate. Every room has its own rhythm.' },
  { num: '04', title: 'Feel Something', desc: 'Rooms end naturally. You leave with a positive emotional residue.' },
];

export default function LandingPage() {
  const router = useRouter();
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    // Check if user is already logged in
    const token = typeof window !== 'undefined' ? localStorage.getItem('rm_token') : null;
    if (token) {
      // Don't auto-redirect — let them see the landing page
    }
  }, []);

  return (
    <div className={styles.landing}>
      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={`container ${styles.navInner}`}>
          <div className={styles.logo}>
            <span className={styles.logoIcon}>◉</span>
            <span>Random Meeting</span>
          </div>
          <div className={styles.navLinks}>
            <button className="btn btn-ghost" onClick={() => router.push('/auth')}>
              Log In
            </button>
            <button className="btn btn-primary" onClick={() => router.push('/auth')}>
              Get Started
            </button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className={`${styles.hero} ${isVisible ? styles.visible : ''}`}>
        <div className="container">
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}></span>
              Human interaction, reimagined
            </div>
            <h1 className={styles.heroTitle}>
              A place where you <span className="text-gradient">belong</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Join structured, time-bound rooms for genuine human connection.
              No feeds. No followers. No performance. Just real conversations
              with real people.
            </p>
            <div className={styles.heroCta}>
              <button className="btn btn-primary btn-lg" onClick={() => router.push('/auth')}>
                Enter a Room →
              </button>
              <button className="btn btn-secondary btn-lg" onClick={() => {
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' });
              }}>
                How It Works
              </button>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>3–15</span>
                <span className={styles.heroStatLabel}>minutes per room</span>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>100%</span>
                <span className={styles.heroStatLabel}>anonymous</span>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>Zero</span>
                <span className={styles.heroStatLabel}>followers needed</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className={styles.howSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>
            How it <span className="text-gradient">works</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Four simple steps to meaningful interaction
          </p>
          <div className={styles.stepsGrid}>
            {STEPS.map((step, i) => (
              <div key={i} className={styles.stepCard} style={{ animationDelay: `${i * 0.1}s` }}>
                <span className={styles.stepNum}>{step.num}</span>
                <h3 className={styles.stepTitle}>{step.title}</h3>
                <p className={styles.stepDesc}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Room Types */}
      <section className={styles.roomsSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>
            Experiences, not <span className="text-gradient">content</span>
          </h2>
          <p className={styles.sectionSubtitle}>
            Every room is designed for participation, not performance
          </p>
          <div className={styles.roomsGrid}>
            {ROOM_TYPES.map((room, i) => (
              <div key={i} className={styles.roomCard} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className={styles.roomCardHeader}>
                  <span className={styles.roomIcon}>{room.icon}</span>
                  <span className={`badge ${room.tag === 'Premium' ? 'badge-premium' : 'badge-free'}`}>
                    {room.tag}
                  </span>
                </div>
                <h3 className={styles.roomCardTitle}>{room.title}</h3>
                <p className={styles.roomCardDesc}>{room.desc}</p>
                <div className={styles.roomCardMeta}>
                  <span>⏱ {room.duration}</span>
                  <span>👥 {room.people}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Values */}
      <section className={styles.valuesSection}>
        <div className="container">
          <h2 className={styles.sectionTitle}>
            What we <span className="text-gradient">don't</span> do
          </h2>
          <div className={styles.valuesGrid}>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No infinite scroll</span>
            </div>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No likes or followers</span>
            </div>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No algorithmic feeds</span>
            </div>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No influencer culture</span>
            </div>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No dating mechanics</span>
            </div>
            <div className={styles.valueCard}>
              <span className={styles.valueX}>✕</span>
              <span>No attention tricks</span>
            </div>
          </div>
          <div className={styles.valuesPositive}>
            <div className={styles.valuePositiveCard}>
              <span className={styles.valueCheck}>✓</span>
              <span>Safe</span>
            </div>
            <div className={styles.valuePositiveCard}>
              <span className={styles.valueCheck}>✓</span>
              <span>Calm</span>
            </div>
            <div className={styles.valuePositiveCard}>
              <span className={styles.valueCheck}>✓</span>
              <span>Intentional</span>
            </div>
            <div className={styles.valuePositiveCard}>
              <span className={styles.valueCheck}>✓</span>
              <span>Human</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <h2 className={styles.ctaTitle}>Ready to feel something real?</h2>
            <p className={styles.ctaDesc}>
              Your first 3 rooms are free, every day. No credit card needed.
            </p>
            <button className="btn btn-primary btn-lg" onClick={() => router.push('/auth')}>
              Start Your First Room →
            </button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={`container ${styles.footerInner}`}>
          <div className={styles.footerLogo}>
            <span className={styles.logoIcon}>◉</span>
            <span>Random Meeting</span>
          </div>
          <p className={styles.footerText}>
            A structured human interaction platform.
            <br />Built with care. Designed for belonging.
          </p>
          <div className={styles.footerLinks}>
            <a href="/auth">Get Started</a>
            <a href="/upgrade">Pricing</a>
          </div>
          <p className={styles.footerCopy}>© 2026 Random Meeting. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}
