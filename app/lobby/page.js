'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import styles from './lobby.module.css';
import { authenticatedFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export default function LobbyPage() {
    const router = useRouter();
    const [rooms, setRooms] = useState([]);
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(null);
    const [filter, setFilter] = useState('all');
    const [search, setSearch] = useState('');

    const fetchRooms = useCallback(async () => {
        try {
            const data = await authenticatedFetch('/api/rooms');
            setRooms(data.rooms || []);
            setUserInfo(data.user || null);
        } catch (err) {
            console.error('Failed to fetch rooms:', err);
            if (err.message.includes('Not authenticated')) {
                localStorage.removeItem('rm_token');
                localStorage.removeItem('rm_user');
                router.push('/auth');
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        fetchRooms();
        const interval = setInterval(fetchRooms, 15000);
        return () => clearInterval(interval);
    }, [fetchRooms]);

    const handleJoin = async (roomId) => {
        try {
            setJoining(roomId);
            await authenticatedFetch(`/api/rooms/join/${roomId}`, { method: 'POST' });
            router.push(`/room/${roomId}`);
        } catch (err) {
            alert(err.message || 'Failed to join room');
        } finally {
            setJoining(null);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem('rm_token');
        localStorage.removeItem('rm_user');
        router.push('/');
    };

    const filteredRooms = rooms.filter(room => {
        if (filter !== 'all' && room.type?.toLowerCase().replace(/[\s_-]/g, '') !== filter) return false;
        if (search && !room.title?.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    const filterOptions = [
        { key: 'all', label: 'All Rooms', icon: '🏠' },
        { key: 'quickchat', label: 'Quick Chat', icon: '💬' },
        { key: 'groupprompt', label: 'Group Prompt', icon: '🗣️' },
        { key: 'confessionroom', label: 'Confession', icon: '🤫' },
        { key: 'taskcollab', label: 'Task Collab', icon: '🤝' },
        { key: 'listeningcircle', label: 'Listening', icon: '👂' },
    ];

    const getRoomIcon = (type) => {
        const icons = {
            'quick_chat': '💬', 'quick-chat': '💬',
            'group_prompt': '🗣️', 'group-prompt': '🗣️',
            'confession_room': '🤫', 'confession': '🤫',
            'task_collab': '🤝', 'task-collab': '🤝',
            'listening_circle': '👂', 'listening-circle': '👂'
        };
        return icons[type] || '💬';
    };

    const getRoomColor = (type) => {
        const colors = {
            'quick_chat': '#7c3aed', 'quick-chat': '#7c3aed',
            'group_prompt': '#ec4899', 'group-prompt': '#ec4899',
            'confession_room': '#10b981', 'confession': '#10b981',
            'task_collab': '#f59e0b', 'task-collab': '#f59e0b',
            'listening_circle': '#60a5fa', 'listening-circle': '#60a5fa'
        };
        return colors[type] || '#7c3aed';
    };

    const getInitial = () => {
        if (userInfo?.displayName) return userInfo.displayName.charAt(0).toUpperCase();
        return '?';
    };

    if (loading) {
        return (
            <div className={styles.loadingPage}>
                <div className="loader"></div>
                <p className={styles.loadingText}>Finding rooms for you...</p>
            </div>
        );
    }

    return (
        <div className={styles.lobby}>
            {/* Nav */}
            <nav className={styles.nav}>
                <div className={`container ${styles.navInner}`}>
                    <a href="/" className={styles.logo}>
                        <span className={styles.logoIcon}>◉</span>
                        <span className={styles.logoText}>Random Meeting</span>
                    </a>
                    <div className={styles.navRight}>
                        {userInfo?.isPremium && (
                            <span className="badge badge-premium">✨ Premium</span>
                        )}
                        <div className={styles.avatar} title={userInfo?.displayName || 'User'}>
                            {getInitial()}
                        </div>
                        <button className={`btn btn-ghost btn-sm`} onClick={handleLogout}>
                            Log out
                        </button>
                    </div>
                </div>
            </nav>

            {/* Main */}
            <main className={styles.main}>
                <div className="container">
                    {/* Welcome Header */}
                    <div className={styles.header}>
                        <div className={styles.headerLeft}>
                            <h1 className={styles.greeting}>
                                {userInfo?.displayName ? `Hey ${userInfo.displayName}` : 'Welcome'} <span className={styles.wave}>👋</span>
                            </h1>
                            <p className={styles.subtitle}>
                                Pick a room and meet someone new. Every conversation ends naturally.
                            </p>
                        </div>
                        {userInfo && (
                            <div className={styles.statsCard}>
                                <div className={styles.statsRow}>
                                    <span className={styles.statsLabel}>Rooms today</span>
                                    <span className={styles.statsValue}>{userInfo.roomsUsedToday}/{userInfo.roomLimit}</span>
                                </div>
                                <div className={styles.progressBar}>
                                    <div
                                        className={styles.progressFill}
                                        style={{ width: `${(userInfo.roomsUsedToday / userInfo.roomLimit) * 100}%` }}
                                    ></div>
                                </div>
                                <span className={styles.statsRemaining}>
                                    {userInfo.roomsRemaining} remaining
                                </span>
                                {!userInfo.isPremium && (
                                    <button
                                        className={`btn btn-sm ${styles.upgradeBtn}`}
                                        onClick={() => router.push('/upgrade')}
                                    >
                                        ✨ Get Premium
                                    </button>
                                )}
                            </div>
                        )}
                    </div>

                    {/* Search & Filter */}
                    <div className={styles.controls}>
                        <div className={styles.searchBox}>
                            <span className={styles.searchIcon}>🔍</span>
                            <input
                                type="text"
                                className={styles.searchInput}
                                placeholder="Search rooms..."
                                value={search}
                                onChange={(e) => setSearch(e.target.value)}
                            />
                        </div>
                        <div className={styles.filters}>
                            {filterOptions.map(f => (
                                <button
                                    key={f.key}
                                    className={`${styles.filterPill} ${filter === f.key ? styles.filterActive : ''}`}
                                    onClick={() => setFilter(f.key)}
                                >
                                    <span>{f.icon}</span>
                                    <span>{f.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Room Grid */}
                    {filteredRooms.length === 0 ? (
                        <div className={styles.emptyState}>
                            <span className={styles.emptyIcon}>🌙</span>
                            <h3>No rooms match your filter</h3>
                            <p>Try a different filter or wait for new rooms to appear.</p>
                        </div>
                    ) : (
                        <div className={styles.roomGrid}>
                            {filteredRooms.map((room, i) => {
                                const color = getRoomColor(room.type);
                                const currentCount = room.currentParticipants || room._count?.participants || 0;
                                const maxCount = room.maxParticipants || 2;
                                const isFull = currentCount >= maxCount;
                                const isActive = room.status === 'active';

                                return (
                                    <div
                                        key={room.id}
                                        className={styles.roomCard}
                                        style={{ animationDelay: `${i * 0.06}s` }}
                                    >
                                        {/* Card glow */}
                                        <div className={styles.cardGlow} style={{ background: `radial-gradient(circle at 50% 0%, ${color}12 0%, transparent 60%)` }}></div>

                                        {/* Top row */}
                                        <div className={styles.cardTop}>
                                            <span className={styles.roomEmoji}>{getRoomIcon(room.type)}</span>
                                            {isActive ? (
                                                <span className={`badge badge-active`}>
                                                    <span className={styles.liveDot}></span> Live
                                                </span>
                                            ) : (
                                                <span className={`badge badge-waiting`}>Waiting</span>
                                            )}
                                        </div>

                                        {/* Title & prompt */}
                                        <h3 className={styles.cardTitle}>{room.title || room.name || 'Unnamed Room'}</h3>
                                        {room.prompt && (
                                            <p className={styles.cardPrompt}>"{room.prompt}"</p>
                                        )}

                                        {/* Meta */}
                                        <div className={styles.cardMeta}>
                                            <div className={styles.metaItem}>
                                                <span>⏱</span>
                                                <span>{room.durationMinutes || room.duration || 5} min</span>
                                            </div>
                                            <div className={styles.metaItem}>
                                                <span>👥</span>
                                                <span>{currentCount}/{maxCount}</span>
                                            </div>
                                        </div>

                                        {/* Capacity bar */}
                                        <div className={styles.capacityBar}>
                                            <div
                                                className={styles.capacityFill}
                                                style={{
                                                    width: `${(currentCount / maxCount) * 100}%`,
                                                    background: isFull ? 'rgba(239, 68, 68, 0.6)' : `${color}99`
                                                }}
                                            ></div>
                                        </div>

                                        {/* Join button */}
                                        <button
                                            className={`btn btn-primary ${styles.joinBtn}`}
                                            onClick={() => handleJoin(room.id)}
                                            disabled={isFull || joining === room.id || (userInfo?.roomsRemaining <= 0)}
                                        >
                                            {joining === room.id ? 'Joining...' :
                                                isFull ? 'Room Full' :
                                                    'Join Room →'}
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
