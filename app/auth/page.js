'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import styles from './auth.module.css';
import { safeFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function AuthPage() {
    const router = useRouter();
    const [mode, setMode] = useState('login'); // login | register
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [nickname, setNickname] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const switchMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
        setPassword('');
        setConfirmPassword('');
    };

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const data = await safeFetch('/api/auth/login', {
                method: 'POST',
                body: JSON.stringify({ email, password })
            });

            localStorage.setItem('rm_token', data.token);
            localStorage.setItem('rm_user', JSON.stringify(data.user));
            router.push('/lobby');
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        // Validation
        if (!email.includes('@')) {
            setError('Please enter a valid email');
            setLoading(false);
            return;
        }
        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            setLoading(false);
            return;
        }
        if (password !== confirmPassword) {
            setError('Passwords do not match');
            setLoading(false);
            return;
        }
        if (nickname.trim().length < 2 || nickname.trim().length > 20) {
            setError('Nickname must be 2-20 characters');
            setLoading(false);
            return;
        }

        try {
            const data = await safeFetch('/api/auth/register', {
                method: 'POST',
                body: JSON.stringify({ email, password, nickname })
            });

            localStorage.setItem('rm_token', data.token);
            localStorage.setItem('rm_user', JSON.stringify(data.user));
            router.push('/lobby');
        } catch (err) {
            setError(err.message);
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
                            {mode === 'login' ? 'Welcome Back' : 'Create Account'}
                        </h1>
                        <p className={styles.authSubtitle}>
                            {mode === 'login'
                                ? 'Sign in to join rooms and meet new people.'
                                : 'Set up your account to get started.'}
                        </p>
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>
                            {error}
                        </div>
                    )}

                    {mode === 'login' && (
                        <form onSubmit={handleLogin} className={styles.authForm}>
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
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Password</label>
                                <div className={styles.passwordWrapper}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input"
                                        placeholder="Enter your password"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading || !email || !password}
                            >
                                {loading ? 'Signing in...' : 'Sign In →'}
                            </button>
                        </form>
                    )}

                    {mode === 'register' && (
                        <form onSubmit={handleRegister} className={styles.authForm}>
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
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Nickname</label>
                                <input
                                    type="text"
                                    className="input"
                                    placeholder="e.g. Abhishek, CoolCoder, Dreamer"
                                    value={nickname}
                                    onChange={(e) => setNickname(e.target.value.slice(0, 20))}
                                    minLength={2}
                                    maxLength={20}
                                    required
                                />
                                <span className={styles.charCount}>{nickname.length}/20</span>
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Password</label>
                                <div className={styles.passwordWrapper}>
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        className="input"
                                        placeholder="Min 6 characters"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        minLength={6}
                                        required
                                    />
                                    <button
                                        type="button"
                                        className={styles.passwordToggle}
                                        onClick={() => setShowPassword(!showPassword)}
                                        tabIndex={-1}
                                    >
                                        {showPassword ? '🙈' : '👁️'}
                                    </button>
                                </div>
                            </div>
                            <div className={styles.inputGroup}>
                                <label className={styles.label}>Confirm Password</label>
                                <input
                                    type={showPassword ? 'text' : 'password'}
                                    className="input"
                                    placeholder="Re-enter your password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    minLength={6}
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="btn btn-primary btn-lg"
                                style={{ width: '100%' }}
                                disabled={loading || !email || !password || !confirmPassword || nickname.trim().length < 2}
                            >
                                {loading ? 'Creating account...' : 'Create Account →'}
                            </button>
                        </form>
                    )}

                    <div className={styles.authToggle}>
                        {mode === 'login' ? (
                            <p>Don&apos;t have an account? <button type="button" onClick={switchMode} className={styles.toggleBtn}>Create one</button></p>
                        ) : (
                            <p>Already have an account? <button type="button" onClick={switchMode} className={styles.toggleBtn}>Sign in</button></p>
                        )}
                    </div>

                    <p className={styles.authNote}>
                        By continuing, you agree to be respectful in all interactions.
                        <br />This platform is built on trust and kindness.
                    </p>
                </div>
            </div>
        </div>
    );
}
