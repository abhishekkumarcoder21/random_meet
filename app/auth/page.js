'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuthPage() {
    const router = useRouter();
    const [step, setStep] = useState('email'); // email | otp | nickname
    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [nickname, setNickname] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSendOTP = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            console.log('[Auth] Sending OTP to:', `${API_URL}/api/auth/send-otp`);
            const res = await fetch(`${API_URL}/api/auth/send-otp`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            setStep('otp');
        } catch (err) {
            console.error('[Auth] Send OTP error:', err);
            if (err instanceof TypeError && err.message === 'Failed to fetch') {
                setError(`Cannot reach server at: ${API_URL}. Please check your connection.`);
            } else {
                setError(err.message || 'Failed to send OTP');
            }
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

            // If user already has a nickname, skip to lobby
            if (data.user.displayName) {
                router.push('/lobby');
            } else {
                setStep('nickname');
            }
        } catch (err) {
            setError(err.message || 'Failed to verify OTP');
        } finally {
            setLoading(false);
        }
    };

    const handleSetNickname = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const token = localStorage.getItem('rm_token');
            const res = await fetch(`${API_URL}/api/auth/set-nickname`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ nickname })
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error);

            // Update stored user with nickname
            localStorage.setItem('rm_user', JSON.stringify(data.user));
            router.push('/lobby');
        } catch (err) {
            setError(err.message || 'Failed to set nickname');
        } finally {
            setLoading(false);
        }
    };

    const getTitle = () => {
        if (step === 'email') return 'Welcome';
        if (step === 'otp') return 'Check your email';
        return 'Choose your name';
    };

    const getSubtitle = () => {
        if (step === 'email') return 'Enter your email to get started. No password needed.';
        if (step === 'otp') return `We sent a 6-digit code to ${email}`;
        return "This is how others will see you in rooms. Make it fun!";
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
                        <h1 className={styles.authTitle}>{getTitle()}</h1>
                        <p className={styles.authSubtitle}>{getSubtitle()}</p>
                    </div>

                    {/* Step indicators */}
                    <div className={styles.steps}>
                        <div className={`${styles.stepDot} ${step === 'email' ? styles.stepActive : styles.stepDone}`}></div>
                        <div className={styles.stepLine}></div>
                        <div className={`${styles.stepDot} ${step === 'otp' ? styles.stepActive : step === 'nickname' ? styles.stepDone : ''}`}></div>
                        <div className={styles.stepLine}></div>
                        <div className={`${styles.stepDot} ${step === 'nickname' ? styles.stepActive : ''}`}></div>
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>
                            {error}
                        </div>
                    )}

                    {step === 'email' && (
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
                    )}

                    {step === 'otp' && (
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
                                {loading ? 'Verifying...' : 'Verify & Continue →'}
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

                    {step === 'nickname' && (
                        <form onSubmit={handleSetNickname} className={styles.authForm}>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Your nickname</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Abhishek, CoolCoder, Dreamer"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                                    minLength={2}
                                    maxLength={20}
                                    required
                                    autoFocus
                                />
                                <span className={styles.charCount}>{nickname.length}/20</span>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading || nickname.trim().length < 2}
                            >
                                {loading ? 'Saving...' : "Let's Go! →"}
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
