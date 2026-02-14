'use client';
import { useState, useEffect, useRef, use } from 'react';
import { useRouter } from 'next/navigation';
import { io } from 'socket.io-client';
import { useWebRTC } from './useWebRTC';
import { VideoTile } from './VideoTile';
import styles from './room.module.css';
import { authenticatedFetch } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const REACTIONS = ['❤️', '👏', '🤗', '💡', '😊', '🎯'];

export default function RoomPage({ params }) {
    const { id: roomId } = use(params);
    const router = useRouter();
    const [messages, setMessages] = useState([]);
    const [participants, setParticipants] = useState([]);
    const [input, setInput] = useState('');
    const [roomInfo, setRoomInfo] = useState(null);
    const [myAlias, setMyAlias] = useState('');
    const [timeLeft, setTimeLeft] = useState(null);
    const [isEnded, setIsEnded] = useState(false);
    const [warning, setWarning] = useState('');
    const [showRules, setShowRules] = useState(true);
    const [showReport, setShowReport] = useState(false);
    const [reportTarget, setReportTarget] = useState('');
    const [reportReason, setReportReason] = useState('');
    const [floatingReactions, setFloatingReactions] = useState([]);
    const [socketError, setSocketError] = useState('');
    const [socketReady, setSocketReady] = useState(false);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);
    const timerRef = useRef(null);

    // WebRTC
    const {
        localStream, remoteStreams, callState, callType,
        isMicOn, isCameraOn, callError, incomingCall,
        startCall, cancelCall, acceptCall, declineCall,
        endCall, toggleMic, toggleCamera
    } = useWebRTC(socketRef, roomId, socketReady);

    useEffect(() => {
        const token = localStorage.getItem('rm_token');
        if (!token) {
            router.push('/auth');
            return;
        }

        // Fetch room details first
        fetchRoom(token);

        // Connect socket
        const socket = io(API_URL, {
            auth: { token }
        });

        socketRef.current = socket;

        socket.on('connect', () => {
            socket.emit('join-room', { roomId });
            setSocketReady(true);
        });

        socket.on('connect_error', (err) => {
            setSocketError('Connection failed. Please refresh.');
        });

        socket.on('room-state', (state) => {
            setParticipants(state.participants);
            setMessages(state.messages.map(m => ({
                ...m,
                isMe: m.isMe
            })));

            if (state.startedAt && state.durationMinutes) {
                startTimer(new Date(state.startedAt), state.durationMinutes);
            }
        });

        socket.on('new-message', (msg) => {
            // Skip messages from self — we already added them optimistically
            const myAlias = localStorage.getItem('rm_alias');
            if (msg.alias === myAlias) return;

            setMessages(prev => [...prev, {
                ...msg,
                isMe: false
            }]);
        });

        socket.on('user-joined', ({ alias, participantCount }) => {
            setParticipants(prev => [...prev, { alias, isMe: false }]);
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                content: `${alias} joined the room`,
                alias: 'System',
                isSystem: true,
                createdAt: new Date()
            }]);
        });

        socket.on('user-left', ({ alias }) => {
            setMessages(prev => [...prev, {
                id: Date.now().toString(),
                content: `${alias} left the room`,
                alias: 'System',
                isSystem: true,
                createdAt: new Date()
            }]);
        });

        socket.on('reaction', ({ alias, emoji }) => {
            const reaction = {
                id: Date.now() + Math.random(),
                emoji,
                alias
            };
            setFloatingReactions(prev => [...prev, reaction]);
            setTimeout(() => {
                setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
            }, 2000);
        });

        socket.on('room-warning', ({ message, secondsLeft }) => {
            setWarning(message);
            setTimeout(() => setWarning(''), 5000);
        });

        socket.on('room-ended', ({ message, prompt }) => {
            setIsEnded(true);
            clearInterval(timerRef.current);
            setMessages(prev => [...prev, {
                id: 'end',
                content: message,
                alias: 'System',
                isSystem: true,
                createdAt: new Date()
            }]);
        });

        socket.on('error-message', ({ error }) => {
            setSocketError(error);
            setTimeout(() => setSocketError(''), 3000);
        });


        return () => {
            clearInterval(timerRef.current);
            socket.disconnect();
            setSocketReady(false);
        };
    }, [roomId]);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    const fetchRoom = async (token) => {
        try {
            const data = await authenticatedFetch(`/api/rooms/${roomId}`);
            setRoomInfo(data);
            const alias = data.myAlias || '';
            setMyAlias(alias);
            if (alias) localStorage.setItem('rm_alias', alias);
            if (data.startedAt && data.durationMinutes) {
                startTimer(new Date(data.startedAt), data.durationMinutes);
            }
        } catch (err) {
            console.error('Failed to fetch room:', err);
        }
    };

    const startTimer = (startedAt, durationMinutes) => {
        clearInterval(timerRef.current);
        const endTime = new Date(startedAt).getTime() + durationMinutes * 60 * 1000;

        timerRef.current = setInterval(() => {
            const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timerRef.current);
            }
        }, 1000);
    };

    const formatTime = (seconds) => {
        if (seconds === null) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    const handleSend = (e) => {
        e.preventDefault();
        if (!input.trim() || isEnded) return;

        socketRef.current?.emit('send-message', {
            roomId,
            content: input.trim()
        });

        // Optimistic add
        setMessages(prev => [...prev, {
            id: Date.now().toString(),
            content: input.trim(),
            alias: myAlias,
            isMe: true,
            createdAt: new Date()
        }]);
        setInput('');
    };

    const handleReaction = (emoji) => {
        socketRef.current?.emit('send-reaction', { roomId, emoji });
        const reaction = { id: Date.now() + Math.random(), emoji, alias: myAlias };
        setFloatingReactions(prev => [...prev, reaction]);
        setTimeout(() => {
            setFloatingReactions(prev => prev.filter(r => r.id !== reaction.id));
        }, 2000);
    };

    const handleReport = async () => {
        if (!reportTarget || !reportReason) return;
        try {
            await authenticatedFetch('/api/reports', {
                method: 'POST',
                body: JSON.stringify({
                    roomId,
                    reportedId: reportTarget,
                    reason: reportReason
                })
            });
            setShowReport(false);
            setReportTarget('');
            setReportReason('');
        } catch (err) {
            console.error('Report failed:', err);
        }
    };

    return (
        <div className={styles.roomPage}>
            {/* Floating Reactions */}
            <div className={styles.floatingReactions}>
                {floatingReactions.map(r => (
                    <div key={r.id} className={styles.floatingEmoji}>
                        {r.emoji}
                    </div>
                ))}
            </div>

            {/* Header */}
            <header className={styles.roomHeader}>
                <div className={styles.roomHeaderLeft}>
                    <button className="btn btn-ghost btn-sm" onClick={() => router.push('/lobby')}>
                        ← Lobby
                    </button>
                    <div className={styles.roomTitleBlock}>
                        <h2 className={styles.roomTitle}>
                            {roomInfo?.title || 'Room'}
                        </h2>
                        <span className={styles.roomType}>{roomInfo?.type}</span>
                    </div>
                </div>
                <div className={styles.roomHeaderRight}>
                    <div className={`${styles.timer} ${timeLeft !== null && timeLeft <= 30 ? styles.timerWarning : ''}`}>
                        ⏱ {formatTime(timeLeft)}
                    </div>
                    <button
                        className={`btn btn-ghost btn-sm ${styles.rulesToggle}`}
                        onClick={() => setShowRules(!showRules)}
                    >
                        📋 Rules
                    </button>
                    <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setShowReport(true)}
                    >
                        🚩 Report
                    </button>
                </div>
            </header>

            {/* Warning Banner */}
            {warning && (
                <div className={styles.warningBanner}>
                    ⚠️ {warning}
                </div>
            )}

            {/* Incoming Call Overlay */}
            {callState === 'ringing' && incomingCall && (
                <div className={styles.incomingCallOverlay}>
                    <div className={styles.incomingCallCard}>
                        <div className={styles.callerAvatar}>
                            <div className={styles.callerAvatarPulse}></div>
                            <span>{incomingCall.callType === 'video' ? '📹' : '🎙️'}</span>
                        </div>
                        <h3 className={styles.callerName}>{incomingCall.alias || 'Someone'}</h3>
                        <p className={styles.callerDesc}>
                            Incoming {incomingCall.callType === 'video' ? 'video' : 'voice'} call...
                        </p>
                        <div className={styles.incomingActions}>
                            <button className={styles.declineBtn} onClick={declineCall}>
                                <span>✕</span>
                                Decline
                            </button>
                            <button className={styles.acceptBtn} onClick={acceptCall}>
                                <span>✓</span>
                                Accept
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Outgoing Call Waiting */}
            {callState === 'calling' && (
                <div className={styles.outgoingCallBar}>
                    <div className={styles.callingPulse}></div>
                    <span>📞 Calling... waiting for answer</span>
                    <button className="btn btn-ghost btn-sm" onClick={cancelCall}>Cancel</button>
                </div>
            )}

            {/* Video Grid (shown when call is active) */}
            {callState === 'active' && (
                <div className={styles.videoGrid}>
                    {localStream && (
                        <VideoTile
                            stream={localStream}
                            alias={myAlias}
                            isMe={true}
                            isMuted={!isMicOn}
                            isCameraOff={!isCameraOn}
                        />
                    )}
                    {Array.from(remoteStreams.entries()).map(([socketId, peer]) => (
                        <VideoTile
                            key={socketId}
                            stream={peer.stream}
                            alias={peer.alias}
                            isMe={false}
                            isMuted={!peer.audioEnabled}
                            isCameraOff={!peer.videoEnabled}
                        />
                    ))}
                </div>
            )}

            {/* Call Controls */}
            {!isEnded && (
                <div className={styles.callControls}>
                    {callState === 'idle' ? (
                        <>
                            <button className={`btn btn-primary btn-sm ${styles.callBtn}`} onClick={() => startCall(true)}>
                                📹 Video Call
                            </button>
                            <button className={`btn btn-secondary btn-sm ${styles.callBtn}`} onClick={() => startCall(false)}>
                                🎙️ Voice Only
                            </button>
                        </>
                    ) : callState === 'active' ? (
                        <>
                            <button
                                className={`${styles.mediaBtn} ${!isMicOn ? styles.mediaBtnOff : ''}`}
                                onClick={toggleMic}
                                title={isMicOn ? 'Mute mic' : 'Unmute mic'}
                            >
                                {isMicOn ? '🎙️' : '🔇'}
                            </button>
                            <button
                                className={`${styles.mediaBtn} ${!isCameraOn ? styles.mediaBtnOff : ''}`}
                                onClick={toggleCamera}
                                title={isCameraOn ? 'Turn off camera' : 'Turn on camera'}
                            >
                                {isCameraOn ? '📹' : '📷'}
                            </button>
                            <button
                                className={`${styles.mediaBtn} ${styles.endCallBtn}`}
                                onClick={endCall}
                                title="End call"
                            >
                                📞
                            </button>
                        </>
                    ) : null}
                    {callError && <span className={styles.callError}>{callError}</span>}
                </div>
            )}

            {/* Room Content */}
            <div className={styles.roomContent}>
                {/* Sidebar / Rules */}
                {showRules && (
                    <aside className={styles.sidebar}>
                        <div className={styles.sidebarSection}>
                            <h4 className={styles.sidebarTitle}>Room Rules</h4>
                            <p className={styles.sidebarText}>{roomInfo?.rules}</p>
                        </div>
                        {roomInfo?.prompt && (
                            <div className={styles.sidebarSection}>
                                <h4 className={styles.sidebarTitle}>Prompt</h4>
                                <p className={styles.sidebarPrompt}>"{roomInfo.prompt}"</p>
                            </div>
                        )}
                        <div className={styles.sidebarSection}>
                            <h4 className={styles.sidebarTitle}>Participants</h4>
                            <div className={styles.participantList}>
                                {participants.map((p, i) => (
                                    <div key={i} className={`${styles.participant} ${p.isMe ? styles.participantMe : ''}`}>
                                        <span className={styles.participantDot}></span>
                                        <span>{p.alias} {p.isMe ? '(you)' : ''}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                        <button
                            className="btn btn-ghost btn-sm"
                            style={{ width: '100%', marginTop: 'auto' }}
                            onClick={() => setShowRules(false)}
                        >
                            Close panel
                        </button>
                    </aside>
                )}

                {/* Chat Area */}
                <div className={styles.chatArea}>
                    <div className={styles.chatMessages}>
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`${styles.message} ${msg.isSystem ? styles.messageSystem : msg.isMe ? styles.messageMe : styles.messageOther}`}
                            >
                                {msg.isSystem ? (
                                    <span className={styles.systemMsg}>{msg.content}</span>
                                ) : (
                                    <>
                                        {!msg.isMe && (
                                            <span className={styles.msgAlias}>{msg.alias}</span>
                                        )}
                                        <div className={styles.msgBubble}>
                                            {msg.content}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))}
                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    {!isEnded ? (
                        <div className={styles.inputArea}>
                            <div className={styles.reactions}>
                                {REACTIONS.map(emoji => (
                                    <button
                                        key={emoji}
                                        className={styles.reactionBtn}
                                        onClick={() => handleReaction(emoji)}
                                        title={`Send ${emoji}`}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                            <form className={styles.inputForm} onSubmit={handleSend}>
                                <input
                                    type="text"
                                    className={`input ${styles.chatInput}`}
                                    placeholder="Type a message..."
                                    value={input}
                                    onChange={(e) => setInput(e.target.value)}
                                    maxLength={500}
                                    autoFocus
                                />
                                <button type="submit" className="btn btn-primary" disabled={!input.trim()}>
                                    Send
                                </button>
                            </form>
                            {socketError && (
                                <p className={styles.socketError}>{socketError}</p>
                            )}
                        </div>
                    ) : (
                        <div className={styles.endedArea}>
                            <div className={styles.endedCard}>
                                <h3>✨ This room has ended</h3>
                                <p>Thank you for being here. We hope you felt something real.</p>
                                <div className={styles.endedActions}>
                                    <button className="btn btn-primary" onClick={() => router.push('/lobby')}>
                                        Back to Lobby →
                                    </button>
                                    <button className="btn btn-secondary" onClick={() => router.push('/upgrade')}>
                                        ✨ Unlock More Rooms
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Report Modal */}
            {showReport && (
                <div className={styles.modalOverlay} onClick={() => setShowReport(false)}>
                    <div className={styles.modal} onClick={e => e.stopPropagation()}>
                        <h3 className={styles.modalTitle}>Report a participant</h3>
                        <p className={styles.modalDesc}>Help us keep this space safe for everyone.</p>

                        <div className={styles.modalField}>
                            <label>Reason</label>
                            <select
                                className="input"
                                value={reportReason}
                                onChange={(e) => setReportReason(e.target.value)}
                            >
                                <option value="">Select a reason</option>
                                <option value="harassment">Harassment</option>
                                <option value="spam">Spam</option>
                                <option value="inappropriate">Inappropriate content</option>
                                <option value="other">Other</option>
                            </select>
                        </div>

                        <div className={styles.modalActions}>
                            <button className="btn btn-ghost" onClick={() => setShowReport(false)}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleReport}
                                disabled={!reportReason}
                            >
                                Submit Report
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
