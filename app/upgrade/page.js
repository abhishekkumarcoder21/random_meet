'use client';
import { Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import styles from './upgrade.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

function UpgradeContent() {
    const router = useRouter();
    const searchParams = useSearchParams();

    const handleCheckout = async () => {
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
            }
        } catch (err) {
            alert('Failed to start checkout');
        }
    };

    const freeFeatures = [
        { text: '3 rooms per day', included: true },
        { text: 'Quick Chat rooms', included: true },
        { text: 'Group Prompt rooms', included: true },
        { text: 'Confession rooms', included: true },
        { text: 'Task Collab rooms', included: false },
        { text: 'Listening Circle rooms', included: false },
        { text: 'Up to 5 min sessions', included: true },
        { text: 'Extended sessions (15 min)', included: false },
    ];

    const premiumFeatures = [
        { text: '15 rooms per day', included: true },
        { text: 'Quick Chat rooms', included: true },
        { text: 'Group Prompt rooms', included: true },
        { text: 'Confession rooms', included: true },
        { text: 'Task Collab rooms', included: true },
        { text: 'Listening Circle rooms', included: true },
        { text: 'Up to 5 min sessions', included: true },
        { text: 'Extended sessions (15 min)', included: true },
    ];

    return (
        <div className={styles.upgradePage}>
            {/* Header */}
            <div className={styles.upgradeHeader}>
                <a href="/lobby" className={styles.backLink}>← Back to Lobby</a>
                <div className={styles.upgradeTag}>✨ Upgrade Your Experience</div>
                <h1 className={styles.upgradeTitle}>Choose your plan</h1>
                <p className={styles.upgradeSubtitle}>
                    Unlock more rooms, longer sessions, and exclusive room types.
                </p>
            </div>

            {/* Pricing Cards */}
            <div className={styles.pricingGrid}>
                {/* Free Plan */}
                <div className={styles.planCard}>
                    <h3 className={styles.planName}>Free</h3>
                    <div className={styles.planPrice}>
                        <span className={styles.priceAmount}>$0</span>
                        <span className={styles.pricePeriod}>/forever</span>
                    </div>
                    <div className={styles.planFeatures}>
                        {freeFeatures.map((f, i) => (
                            <div key={i} className={styles.feature}>
                                <span className={f.included ? styles.featureCheck : styles.featureCross}>
                                    {f.included ? '✓' : '✕'}
                                </span>
                                <span>{f.text}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        className={`btn btn-secondary ${styles.planBtn}`}
                        onClick={() => router.push('/lobby')}
                    >
                        Current Plan
                    </button>
                </div>

                {/* Premium Plan */}
                <div className={`${styles.planCard} ${styles.planFeatured}`}>
                    <div className={styles.planFeaturedGlow}></div>
                    <span className={styles.planBadge}>Most Popular</span>
                    <h3 className={styles.planName}>Premium</h3>
                    <div className={styles.planPrice}>
                        <span className={styles.priceAmount}>$4.99</span>
                        <span className={styles.pricePeriod}>/month</span>
                    </div>
                    <div className={styles.planFeatures}>
                        {premiumFeatures.map((f, i) => (
                            <div key={i} className={styles.feature}>
                                <span className={styles.featureCheck}>✓</span>
                                <span>{f.text}</span>
                            </div>
                        ))}
                    </div>
                    <button
                        className={`btn btn-primary ${styles.planBtn}`}
                        onClick={handleCheckout}
                    >
                        Upgrade Now →
                    </button>
                </div>
            </div>

            {/* Comparison */}
            <div className={styles.comparisonSection}>
                <h3 className={styles.comparisonTitle}>Feature comparison</h3>
                <table className={styles.comparisonTable}>
                    <thead>
                        <tr>
                            <th>Feature</th>
                            <th>Free</th>
                            <th>Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Daily room limit</td><td>3</td><td>15</td></tr>
                        <tr><td>Max session length</td><td>5 min</td><td>15 min</td></tr>
                        <tr><td>Quick Chat</td><td>✓</td><td>✓</td></tr>
                        <tr><td>Group Prompt</td><td>✓</td><td>✓</td></tr>
                        <tr><td>Confession Room</td><td>✓</td><td>✓</td></tr>
                        <tr><td>Task Collab</td><td>✕</td><td>✓</td></tr>
                        <tr><td>Listening Circle</td><td>✕</td><td>✓</td></tr>
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default function UpgradePage() {
    return (
        <Suspense fallback={
            <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div className="loader"></div>
            </div>
        }>
            <UpgradeContent />
        </Suspense>
    );
}
