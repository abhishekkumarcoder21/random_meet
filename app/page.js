'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LandingPage() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const heroRef = useRef(null);

  useEffect(() => {
    setVisible(true);
  }, []);

  const roomTypes = [
    {
      icon: '💬',
      title: 'Quick Chat',
      desc: 'Genuine 5-minute conversations with a stranger. No pressure, just be you.',
      time: '5 min',
      people: '2',
      color: '#7c3aed'
    },
    {
      icon: '🗣️',
      title: 'Group Prompt',
      desc: 'Everyone answers the same question. Surprising perspectives guaranteed.',
      time: '10 min',
      people: '4-6',
      color: '#ec4899'
    },
    {
      icon: '🤫',
      title: 'Confession Room',
      desc: 'Share something anonymously. Zero judgement. Just humans being real.',
      time: '3 min',
      people: '6',
      color: '#10b981'
    },
    {
      icon: '🤝',
      title: 'Task Collab',
      desc: 'Two strangers, one creative task. Write poetry or design a café together.',
      time: '8 min',
      people: '2',
      color: '#f59e0b',
      premium: true
    },
    {
      icon: '👂',
      title: 'Listening Circle',
      desc: 'One person shares, others listen and support. Deep, meaningful connection.',
      time: '7 min',
      people: '3-5',
      color: '#60a5fa',
      premium: true
    }
  ];

  const steps = [
    { num: '01', title: 'Enter your email', desc: 'No passwords — just a quick OTP verification.' },
    { num: '02', title: 'Pick a room', desc: 'Choose from Quick Chat, Group Prompt, Confession & more.' },
    { num: '03', title: 'Meet someone new', desc: 'Chat with anonymous aliases. Be yourself, fully.' },
    { num: '04', title: 'Room ends naturally', desc: 'Every conversation has a timer. Clean endings, no ghosting.' },
  ];

  return (
    <div className={styles.landing}>
      {/* Floating orbs */}
      <div className={styles.orb1}></div>
      <div className={styles.orb2}></div>
      <div className={styles.orb3}></div>

      {/* Navigation */}
      <nav className={styles.nav}>
        <div className={`container ${styles.navInner}`}>
          <a href="/" className={styles.logo}>
            <span className={styles.logoIcon}>◉</span>
            <span className={styles.logoText}>Random Meeting</span>
          </a>
          <div className={styles.navLinks}>
            <a href="#rooms" className={`btn btn-ghost btn-sm`}>Rooms</a>
            <a href="#how" className={`btn btn-ghost btn-sm`}>How it works</a>
            <button className={`btn btn-primary btn-sm`} onClick={() => router.push('/auth')}>
              Join Now
            </button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className={`${styles.hero} ${visible ? styles.heroVisible : ''}`} ref={heroRef}>
        <div className="container">
          <div className={styles.heroContent}>
            <div className={styles.heroBadge}>
              <span className={styles.heroBadgeDot}></span>
              <span>250+ strangers met today</span>
            </div>
            <h1 className={styles.heroTitle}>
              Where strangers become
              <br />
              <span className={styles.heroTitleGradient}>something more.</span>
            </h1>
            <p className={styles.heroSubtitle}>
              Time-bound rooms. Anonymous identities. Real human connection.
              <br />
              No followers. No likes. Just conversations that end naturally.
            </p>
            <div className={styles.heroCta}>
              <button className={`btn btn-primary btn-lg ${styles.heroBtn}`} onClick={() => router.push('/auth')}>
                Start Meeting →
              </button>
              <button className={`btn btn-secondary btn-lg`} onClick={() => document.getElementById('rooms')?.scrollIntoView({ behavior: 'smooth' })}>
                Explore Rooms
              </button>
            </div>
            <div className={styles.heroStats}>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>5K+</span>
                <span className={styles.heroStatLabel}>Meetings held</span>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>2min</span>
                <span className={styles.heroStatLabel}>Avg. wait time</span>
              </div>
              <div className={styles.statDivider}></div>
              <div className={styles.heroStat}>
                <span className={styles.heroStatNum}>98%</span>
                <span className={styles.heroStatLabel}>Respectful chats</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className={styles.howSection} id="how">
        <div className="container">
          <p className={styles.sectionTag}>Simple & Clear</p>
          <h2 className={styles.sectionTitle}>How it works</h2>
          <p className={styles.sectionSubtitle}>Four steps. Zero friction. Pure connection.</p>
          <div className={styles.stepsGrid}>
            {steps.map((step, i) => (
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
      <section className={styles.roomsSection} id="rooms">
        <div className="container">
          <p className={styles.sectionTag}>Explore</p>
          <h2 className={styles.sectionTitle}>Room types</h2>
          <p className={styles.sectionSubtitle}>Each room has a purpose. Pick the one that calls to you.</p>
          <div className={styles.roomsGrid}>
            {roomTypes.map((room, i) => (
              <div key={i} className={styles.roomCard} style={{ animationDelay: `${i * 0.08}s` }}>
                <div className={styles.roomCardGlow} style={{ background: `radial-gradient(circle at 50% 0%, ${room.color}15 0%, transparent 70%)` }}></div>
                <div className={styles.roomCardHeader}>
                  <span className={styles.roomIcon}>{room.icon}</span>
                  {room.premium && <span className="badge badge-premium">✨ Premium</span>}
                </div>
                <h3 className={styles.roomCardTitle}>{room.title}</h3>
                <p className={styles.roomCardDesc}>{room.desc}</p>
                <div className={styles.roomCardMeta}>
                  <span>⏱ {room.time}</span>
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
          <p className={styles.sectionTag}>Our Promise</p>
          <h2 className={styles.sectionTitle}>What we don't do</h2>
          <p className={styles.sectionSubtitle}>We built the anti-social-media. On purpose.</p>
          <div className={styles.valuesGrid}>
            {['Infinite scroll', 'Public feeds', 'Likes & followers', 'Influencer culture', 'Dating mechanics', 'Ad-driven revenue'].map((val, i) => (
              <div key={i} className={styles.valueCard}>
                <span className={styles.valueX}>✕</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
          <div className={styles.valuesPositive}>
            {['Real conversations', 'Genuine connection', 'Respectful spaces', 'Clean endings'].map((val, i) => (
              <div key={i} className={styles.valuePositiveCard}>
                <span className={styles.valueCheck}>✓</span>
                <span>{val}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className={styles.ctaSection}>
        <div className="container">
          <div className={styles.ctaCard}>
            <div className={styles.ctaGlow}></div>
            <h2 className={styles.ctaTitle}>
              Ready to meet <span className="text-gradient">someone new</span>?
            </h2>
            <p className={styles.ctaDesc}>
              Join a room and have a genuine conversation with a stranger.
              <br />It only takes 5 minutes.
            </p>
            <button className={`btn btn-primary btn-lg ${styles.ctaBtn}`} onClick={() => router.push('/auth')}>
              Start Your First Meeting →
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
            Structured spaces for unstructured humans.
          </p>
          <div className={styles.footerLinks}>
            <a href="#">About</a>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Support</a>
          </div>
          <p className={styles.footerCopy}>
            © 2026 Random Meeting. Built with ❤️ for humans who want to feel something real.
          </p>
        </div>
      </footer>
    </div>
  );
}
