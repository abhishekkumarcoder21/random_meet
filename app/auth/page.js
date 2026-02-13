'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuthPage() {
    const router = useRouter();
    const [step, setStep] = useState('email'); // email | otp
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setStep('otp');
        } catch (err) {
            setError(err.message || 'Failed to send OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleVerifyOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const res = await fetch(`${API_URL}/api/auth/verify-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, code: otp })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Store token and user
            localStorage.setItem('rm_token', data.token);
            localStorage.setItem('rm_user', JSON.stringify(data.user));

            router.push('/lobby');
        } catch (err) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className={styles.authPage}>
            <div className={styles.authContainer}>
                <div className={styles.authCard}>
                    <div className={styles.authHeader}>
                        <a href="/" className={styles.backLink}>← Back</a>
                        <div className={styles.authLogo}>
                            <span className={styles.logoIcon}>◉</span>
                            <span>Random Meeting</span>
                        </div>
                        <h1 className={styles.authTitle}>
                            {step === 'email' ? 'Welcome' : 'Check your email'}
                        </h1>
                        <p className={styles.authSubtitle}>
                            {step === 'email'
                                ? 'Enter your email to get started. No password needed.'
                                : `We sent a 6-digit code to ${email}`
                            }
                        </p>
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>
                            {error}
                        </div>
                    )}

                    {step === 'email' ? (
                        <form onSubmit={handleSendOTP} className={styles.authForm}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Email address</label>
                                <input
                                    type="email"
                                    className="input"
                                    placeholder="you@example.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading || !email}
                            >
                                {loading ? 'Sending...' : 'Send Verification Code →'}
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleVerifyOTP} className={styles.authForm}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>6-digit code</label>
                                <input
                                    type="text"
                                    className={`input ${styles.otpInput}`}
                                    placeholder="000000"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                    maxLength={6}
                                    required
                                    autoFocus
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading || otp.length !== 6}
                            >
                                {loading ? 'Verifying...' : 'Verify & Enter →'}
                            </button>
                            <button
                                type="button"
                                className="btn btn-ghost"
                                style={{ width: '100%', marginTop: '0.5rem' }}
                                onClick={() => { setStep('email'); setOtp(''); setError(''); }}
                            >
                                Use a different email
                            </button>
                        </form>
                    )}

                    <p className={styles.authNote}>
                        By continuing, you agree to be respectful in all interactions.
                        <br />This platform is built on trust and kindness.
                    </p>
                </div>
            </div>
        </div>
    );
}
