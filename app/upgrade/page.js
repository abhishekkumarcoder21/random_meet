'use client';
import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './upgrade.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const FEATURES = [
    { feature: 'Rooms per day', free: '3', premium: '15' },
    { feature: 'Max session', free: '5 min', premium: '15 min' },
    { feature: 'Quick Chat', free: '✓', premium: '✓' },
    { feature: 'Group Prompt', free: '✓', premium: '✓' },
    { feature: 'Confession Room', free: '✓', premium: '✓' },
    { feature: 'Task Collab', free: '—', premium: '✓' },
    { feature: 'Listening Circle', free: '—', premium: '✓' },
    { feature: 'Priority matching', free: '—', premium: '✓' },
    { feature: 'Re-enter good rooms', free: '—', premium: '✓' },
];

export default function UpgradePage() {
    return (
        <Suspense fallback={<div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="loader"></div></div>}>
            <UpgradeContent />
        </Suspense>
    );
}

function UpgradeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(false);
    const [isPremium, setIsPremium] = useState(false);
    const cancelled = searchParams.get('cancelled');

    useEffect(() => {
        const token = localStorage.getItem('rm_token');
        if (!token) {
            router.push('/auth');
            return;
        }
        checkSubscription(token);
    }, []);

    const checkSubscription = async (token) => {
        try {
            const res = await fetch(`${API_URL}/api/subscription/status`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            const data = await res.json();
            setIsPremium(data.isPremium);
        } catch (err) {
            console.error('Subscription check failed');
        }
    };

    const handleUpgrade = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem('rm_token');
            const res = await fetch(`${API_URL}/api/subscription/checkout`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });
            const data = await res.json();
            if (data.url) {
                window.location.href = data.url;
            } else {
                throw new Error('No checkout URL');
            }
        } catch (err) {
            console.error('Checkout failed:', err);
            setLoading(false);
        }
    };

    return (
        <div className={styles.upgradePage}>
            <div className="container">
                {/* Header */}
                <header className={styles.header}>
                    <button className="btn btn-ghost" onClick={() => router.push('/lobby')}>
                        ← Back to Lobby
                    </button>
                </header>

                {cancelled && (
                    <div className={styles.cancelledMsg}>
                        No worries! Your free rooms are still waiting for you.
                    </div>
                )}

                {/* Hero */}
                <div className={styles.hero}>
                    <h1 className={styles.heroTitle}>
                        Deepen your <span className="text-gradient">experience</span>
                    </h1>
                    <p className={styles.heroSubtitle}>
                        More rooms. Longer sessions. Premium interactions.
                        <br />Support a platform built for humans, not algorithms.
                    </p>
                </div>

                {/* Pricing Cards */}
                <div className={styles.pricingGrid}>
                    {/* Free Tier */}
                    <div className={styles.pricingCard}>
                        <div className={styles.pricingHeader}>
                            <span className={styles.planName}>Free</span>
                            <div className={styles.priceBlock}>
                                <span className={styles.price}>$0</span>
                                <span className={styles.pricePeriod}>forever</span>
                            </div>
                            <p className={styles.planDesc}>Get a taste of genuine connection</p>
                        </div>
                        <ul className={styles.featureList}>
                            <li>3 rooms per day</li>
                            <li>Up to 5-minute sessions</li>
                            <li>Quick Chat & Group Prompt access</li>
                            <li>Confession Room access</li>
                            <li>Full safety & reporting</li>
                        </ul>
                        <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} onClick={() => router.push('/lobby')}>
                            Continue Free
                        </button>
                    </div>

                    {/* Premium Tier */}
                    <div className={`${styles.pricingCard} ${styles.pricingPremium}`}>
                        <div className={styles.premiumBadge}>Recommended</div>
                        <div className={styles.pricingHeader}>
                            <span className={styles.planName}>Premium</span>
                            <div className={styles.priceBlock}>
                                <span className={styles.price}>$4.99</span>
                                <span className={styles.pricePeriod}>/month</span>
                            </div>
                            <p className={styles.planDesc}>The full experience — no limits on belonging</p>
                        </div>
                        <ul className={styles.featureList}>
                            <li className={styles.featureHighlight}>15 rooms per day</li>
                            <li className={styles.featureHighlight}>Up to 15-minute sessions</li>
                            <li>All room types unlocked</li>
                            <li>Task Collab & Listening Circle</li>
                            <li>Priority matching</li>
                            <li>Re-enter memorable rooms</li>
                            <li>Support a human-first platform</li>
                        </ul>
                        {isPremium ? (
                            <button className="btn btn-secondary btn-lg" style={{ width: '100%' }} disabled>
                                ✨ You're Premium
                            </button>
                        ) : (
                            <button
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                onClick={handleUpgrade}
                                disabled={loading}
                            >
                                {loading ? 'Redirecting...' : 'Upgrade to Premium →'}
                            </button>
                        )}
                    </div>
                </div>

                {/* Comparison Table */}
                <div className={styles.comparisonSection}>
                    <h3 className={styles.comparisonTitle}>Full comparison</h3>
                    <table className={styles.comparisonTable}>
                        <thead>
                            <tr>
                                <th>Feature</th>
                                <th>Free</th>
                                <th>Premium</th>
                            </tr>
                        </thead>
                        <tbody>
                            {FEATURES.map((row, i) => (
                                <tr key={i}>
                                    <td>{row.feature}</td>
                                    <td>{row.free}</td>
                                    <td className={styles.premiumCell}>{row.premium}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                {/* Note */}
                <div className={styles.note}>
                    <p>
                        💚 Your subscription directly supports a platform that respects your time and attention.
                        <br />No ads. No data selling. No attention tricks. Just humans connecting meaningfully.
                    </p>
                </div>
            </div>
        </div>
    );
}
