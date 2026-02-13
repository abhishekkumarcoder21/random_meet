'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './lobby.module.css';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const ROOM_ICONS = {
    'quick-chat': '💬',
    'group-prompt': '🗣️',
    'confession': '🤫',
    'task-collab': '🤝',
    'listening-circle': '👂'
};

const ROOM_LABELS = {
    'quick-chat': 'Quick Chat',
    'group-prompt': 'Group Prompt',
    'confession': 'Confession',
    'task-collab': 'Task Collab',
    'listening-circle': 'Listening Circle'
};

export default function LobbyPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState([]);
    const [userInfo, setUserInfo] = useState(null);
    const [filter, setFilter] = useState('all');
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const token = localStorage.getItem('rm_token');
        if (!token) {
            router.push('/auth');
            return;
        }
        fetchRooms();
        const interval = setInterval(fetchRooms, 10000); // refresh every 10s
        return () => clearInterval(interval);
    }, []);

    const fetchRooms = async () => {
        try {
            const token = localStorage.getItem('rm_token');
            const res = await fetch(`${API_URL}/api/rooms`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (res.status === 401) {
                localStorage.removeItem('rm_token');
                router.push('/auth');
                return;
            }

            const data = await res.json();
            setRooms(data.rooms || []);
            setUserInfo(data.user || null);
            setLoading(false);
        } catch (err) {
            setError('Failed to load rooms');
            setLoading(false);
        }
    };

    const handleJoin = async (roomId) => {
        setJoining(roomId);
        setError('');

        try {
            const token = localStorage.getItem('rm_token');
            const res = await fetch(`${API_URL}/api/rooms/join/${roomId}`, {
                method: 'POST',
                headers: {
                    Authorization: `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (!res.ok) {
                if (data.upgrade) {
                    router.push('/upgrade');
                    return;
                }
                throw new Error(data.error);
            }

            // Store alias for room
            localStorage.setItem('rm_alias', data.alias);
            router.push(`/room/${roomId}`);
        } catch (err) {
            setError(err.message || 'Failed to join room');
            setJoining(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('rm_token');
        localStorage.removeItem('rm_user');
        router.push('/');
    };

    const filteredRooms = rooms.filter(r => {
        if (filter === 'all') return true;
        if (filter === 'free') return !r.isPremium;
        if (filter === 'premium') return r.isPremium;
        return r.type === filter;
    });

    if (loading) {
        return (
            <div className={styles.loadingPage}>
                <div className="loader"></div>
                <p>Loading rooms...</p>
            </div>
        );
    }

    return (
        <div className={styles.lobbyPage}>
            {/* Header */}
            <header className={styles.header}>
                <div className={`container ${styles.headerInner}`}>
                    <div className={styles.headerLeft}>
                        <a href="/" className={styles.logo}>
                            <span className={styles.logoIcon}>◉</span>
                            <span>Random Meeting</span>
                        </a>
                    </div>
                    <div className={styles.headerRight}>
                        {userInfo && !userInfo.isPremium && (
                            <button className="btn btn-secondary btn-sm" onClick={() => router.push('/upgrade')}>
                                ✨ Upgrade
                            </button>
                        )}
                        {userInfo?.isPremium && (
                            <span className="badge badge-premium">✨ Premium</span>
                        )}
                        <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
                            Log out
                        </button>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className={styles.main}>
                <div className="container">
                    {/* Welcome & Stats */}
                    <div className={styles.welcomeSection}>
                        <div>
                            <h1 className={styles.welcomeTitle}>
                                Find your room
                            </h1>
                            <p className={styles.welcomeSubtitle}>
                                Join a structured experience. Every room ends naturally.
                            </p>
                        </div>
                        {userInfo && (
                            <div className={styles.usageCard}>
                                <div className={styles.usageBar}>
                                    <div
                                        className={styles.usageFill}
                                        style={{ width: `${(userInfo.roomsUsedToday / userInfo.roomLimit) * 100}%` }}
                                    ></div>
                                </div>
                                <span className={styles.usageText}>
                                    {userInfo.roomsRemaining} of {userInfo.roomLimit} rooms remaining today
                                </span>
                            </div>
                        )}
                    </div>

                    {error && (
                        <div className={styles.errorMsg}>{error}</div>
                    )}

                    {/* Filters */}
                    <div className={styles.filters}>
                        {[
                            { key: 'all', label: 'All Rooms' },
                            { key: 'quick-chat', label: '💬 Quick Chat' },
                            { key: 'group-prompt', label: '🗣️ Group Prompt' },
                            { key: 'confession', label: '🤫 Confession' },
                            { key: 'task-collab', label: '🤝 Task Collab' },
                            { key: 'listening-circle', label: '👂 Listening' },
                        ].map(f => (
                            <button
                                key={f.key}
                                className={`${styles.filterBtn} ${filter === f.key ? styles.filterActive : ''}`}
                                onClick={() => setFilter(f.key)}
                            >
                                {f.label}
                            </button>
                        ))}
                    </div>

                    {/* Room Grid */}
                    <div className={styles.roomGrid}>
                        {filteredRooms.length === 0 ? (
                            <div className={styles.emptyState}>
                                <p>No rooms available right now. Check back in a moment.</p>
                            </div>
                        ) : (
                            filteredRooms.map((room, i) => (
                                <div
                                    key={room.id}
                                    className={styles.roomCard}
                                    style={{ animationDelay: `${i * 0.05}s` }}
                                >
                                    <div className={styles.roomCardTop}>
                                        <div className={styles.roomCardIcon}>
                                            {ROOM_ICONS[room.type] || '🌐'}
                                        </div>
                                        <div className={styles.roomCardBadges}>
                                            <span className={`badge ${room.status === 'active' ? 'badge-active' : 'badge-waiting'}`}>
                                                {room.status === 'active' ? '● Live' : '○ Waiting'}
                                            </span>
                                            {room.isPremium && (
                                                <span className="badge badge-premium">✨ Premium</span>
                                            )}
                                        </div>
                                    </div>

                                    <h3 className={styles.roomCardTitle}>{room.title}</h3>

                                    {room.prompt && (
                                        <p className={styles.roomCardPrompt}>"{room.prompt}"</p>
                                    )}

                                    <div className={styles.roomCardMeta}>
                                        <span>⏱ {room.durationMinutes} min</span>
                                        <span>👥 {room.currentParticipants}/{room.maxParticipants}</span>
                                    </div>

                                    {room.participants.length > 0 && (
                                        <div className={styles.roomCardParticipants}>
                                            {room.participants.map((alias, j) => (
                                                <span key={j} className={styles.participantChip}>{alias}</span>
                                            ))}
                                        </div>
                                    )}

                                    <button
                                        className={`btn btn-primary ${styles.joinBtn}`}
                                        onClick={() => handleJoin(room.id)}
                                        disabled={
                                            joining === room.id ||
                                            room.currentParticipants >= room.maxParticipants ||
                                            (userInfo && userInfo.roomsRemaining <= 0)
                                        }
                                    >
                                        {joining === room.id
                                            ? 'Joining...'
                                            : room.currentParticipants >= room.maxParticipants
                                                ? 'Full'
                                                : userInfo && userInfo.roomsRemaining <= 0
                                                    ? 'Limit Reached'
                                                    : 'Join Room →'
                                        }
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
