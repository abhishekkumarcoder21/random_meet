'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

export function useWebRTC(socketRef, roomId, socketReady) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [callState, setCallState] = useState('idle'); // idle | calling | ringing | active
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [callError, setCallError] = useState('');
    const [incomingCall, setIncomingCall] = useState(null); // { fromSocketId, alias, callType }
    const [callType, setCallType] = useState('video');

    const peerConnections = useRef(new Map());
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef(new Map());
    const ringTimeoutRef = useRef(null);
    const ringtoneRef = useRef(null);
    // Use refs to avoid stale closures in socket handlers
    const callStateRef = useRef('idle');
    const incomingCallRef = useRef(null);
    const playRingtoneRef = useRef(null);
    const stopRingtoneRef = useRef(null);

    // Keep refs in sync with state
    useEffect(() => { callStateRef.current = callState; }, [callState]);
    useEffect(() => { incomingCallRef.current = incomingCall; }, [incomingCall]);

    // ====== Ringtone using Web Audio API ======
    const stopRingtone = useCallback(() => {
        if (ringtoneRef.current) {
            const { intervalId, audioCtx } = ringtoneRef.current;
            clearInterval(intervalId);
            try { audioCtx.close(); } catch { }
            ringtoneRef.current = null;
        }
    }, []);

    const playRingtone = useCallback((type) => {
        // type: 'incoming' (classic ring) or 'outgoing' (ring-back)
        stopRingtone();
        try {
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

            const playBeep = (freq, duration, startTime) => {
                const osc = audioCtx.createOscillator();
                const gain = audioCtx.createGain();
                osc.connect(gain);
                gain.connect(audioCtx.destination);
                osc.frequency.value = freq;
                osc.type = 'sine';
                gain.gain.setValueAtTime(0.12, startTime);
                gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
                osc.start(startTime);
                osc.stop(startTime + duration);
            };

            // Play immediately
            const ringOnce = () => {
                const now = audioCtx.currentTime;
                if (type === 'incoming') {
                    // Classic double-ring: two short beeps
                    playBeep(440, 0.4, now);
                    playBeep(440, 0.4, now + 0.5);
                } else {
                    // Ring-back: single longer tone
                    playBeep(400, 1.2, now);
                }
            };

            ringOnce();
            const intervalId = setInterval(ringOnce, type === 'incoming' ? 2500 : 3500);
            ringtoneRef.current = { audioCtx, intervalId };
        } catch { }
    }, [stopRingtone]);

    // Keep function refs in sync
    useEffect(() => { playRingtoneRef.current = playRingtone; }, [playRingtone]);
    useEffect(() => { stopRingtoneRef.current = stopRingtone; }, [stopRingtone]);

    const cleanupPeer = useCallback((socketId) => {
        const pc = peerConnections.current.get(socketId);
        if (pc) {
            pc.close();
            peerConnections.current.delete(socketId);
        }
        pendingCandidates.current.delete(socketId);
        setRemoteStreams(prev => {
            const next = new Map(prev);
            next.delete(socketId);
            return next;
        });
    }, []);

    const createPeerConnection = useCallback((remoteSocketId, remoteAlias) => {
        if (peerConnections.current.has(remoteSocketId)) {
            const existing = peerConnections.current.get(remoteSocketId);
            // Reuse only if still usable; otherwise close and recreate
            if (existing.connectionState !== 'closed' && existing.connectionState !== 'failed') {
                return existing;
            }
            existing.close();
            peerConnections.current.delete(remoteSocketId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        pc.ontrack = (event) => {
            const remoteStream = event.streams[0];
            if (remoteStream) {
                setRemoteStreams(prev => {
                    const next = new Map(prev);
                    const existing = next.get(remoteSocketId) || {};
                    next.set(remoteSocketId, {
                        ...existing,
                        stream: remoteStream,
                        alias: remoteAlias || existing.alias || 'Unknown',
                        audioEnabled: existing.audioEnabled !== undefined ? existing.audioEnabled : true,
                        videoEnabled: existing.videoEnabled !== undefined ? existing.videoEnabled : true,
                    });
                    return next;
                });
            }
        };

        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('webrtc-ice-candidate', {
                    toSocketId: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                cleanupPeer(remoteSocketId);
            }
        };

        peerConnections.current.set(remoteSocketId, pc);

        const pending = pendingCandidates.current.get(remoteSocketId) || [];
        pending.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        });
        pendingCandidates.current.delete(remoteSocketId);

        return pc;
    }, [socketRef, cleanupPeer]);

    const getMediaStream = useCallback(async (withVideo) => {
        return navigator.mediaDevices.getUserMedia({
            audio: true,
            video: withVideo ? {
                width: { ideal: 640 },
                height: { ideal: 480 },
                frameRate: { ideal: 24 }
            } : false
        });
    }, []);

    // Initiate a call
    const startCall = useCallback(async (videoEnabled = true) => {
        try {
            setCallError('');
            const type = videoEnabled ? 'video' : 'voice';
            setCallType(type);
            setCallState('calling');
            callStateRef.current = 'calling';

            const stream = await getMediaStream(videoEnabled);
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setIsCameraOn(videoEnabled);

            // Send invite to room
            socketRef.current?.emit('call-invite', { roomId, callType: type });

            // Play outgoing ring-back tone
            playRingtone('outgoing');

            // Auto-cancel after 30s
            ringTimeoutRef.current = setTimeout(() => {
                if (callStateRef.current === 'calling') {
                    stopRingtone();
                    socketRef.current?.emit('call-cancel', { roomId });
                    localStreamRef.current?.getTracks().forEach(t => t.stop());
                    localStreamRef.current = null;
                    setLocalStream(null);
                    setCallState('idle');
                    callStateRef.current = 'idle';
                    setCallError('No answer.');
                    setTimeout(() => setCallError(''), 3000);
                }
            }, 30000);
        } catch (err) {
            setCallState('idle');
            callStateRef.current = 'idle';
            if (err.name === 'NotAllowedError') {
                setCallError('Camera/mic permission denied.');
            } else if (err.name === 'NotFoundError') {
                setCallError('No camera or microphone found.');
            } else {
                setCallError('Failed to start call.');
            }
        }
    }, [socketRef, roomId, getMediaStream]);

    // Cancel outgoing call
    const cancelCall = useCallback(() => {
        stopRingtone();
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        socketRef.current?.emit('call-cancel', { roomId });
        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setCallState('idle');
        callStateRef.current = 'idle';
    }, [socketRef, roomId]);

    // Accept incoming call
    const acceptCall = useCallback(async () => {
        const incoming = incomingCallRef.current;
        if (!incoming) return;

        stopRingtone();
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        const { fromSocketId, callType: type } = incoming;

        try {
            setCallType(type);
            const withVideo = type === 'video';

            const stream = await getMediaStream(withVideo);
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setIsCameraOn(withVideo);
            setCallState('active');
            callStateRef.current = 'active';
            setIncomingCall(null);
            incomingCallRef.current = null;

            // Notify caller — the caller will then create and send the WebRTC offer
            socketRef.current?.emit('call-accept', { toSocketId: fromSocketId, roomId });

        } catch (err) {
            console.error('Accept call error:', err);
            setCallState('idle');
            callStateRef.current = 'idle';
            setIncomingCall(null);
            incomingCallRef.current = null;
            setCallError('Failed to accept call.');
        }
    }, [socketRef, roomId, getMediaStream, createPeerConnection]);

    // Decline incoming call
    const declineCall = useCallback(() => {
        stopRingtone();
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        const incoming = incomingCallRef.current;
        if (incoming) {
            socketRef.current?.emit('call-decline', { toSocketId: incoming.fromSocketId, roomId });
        }
        setIncomingCall(null);
        incomingCallRef.current = null;
        setCallState('idle');
        callStateRef.current = 'idle';
    }, [socketRef, roomId]);

    // End active call
    const endCall = useCallback(() => {
        stopRingtone();
        if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
        pendingCandidates.current.clear();

        setRemoteStreams(new Map());
        setCallState('idle');
        callStateRef.current = 'idle';
        setIsMicOn(true);
        setIsCameraOn(true);
        setIncomingCall(null);
        incomingCallRef.current = null;

        socketRef.current?.emit('call-ended', { roomId });
    }, [socketRef, roomId]);

    // Toggle mic
    const toggleMic = useCallback(() => {
        if (!localStreamRef.current) return;
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMicOn(audioTrack.enabled);
            socketRef.current?.emit('toggle-media', { roomId, kind: 'audio', enabled: audioTrack.enabled });
        }
    }, [socketRef, roomId]);

    // Toggle camera
    const toggleCamera = useCallback(() => {
        if (!localStreamRef.current) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOn(videoTrack.enabled);
            socketRef.current?.emit('toggle-media', { roomId, kind: 'video', enabled: videoTrack.enabled });
        }
    }, [socketRef, roomId]);

    // Socket listeners — registered ONCE, use refs for current state
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        // Incoming call invite
        const handleCallInvite = ({ fromSocketId, alias, callType: type }) => {
            console.log('📞 call-invite received from', alias, '| current state:', callStateRef.current);
            // Ignore if already busy
            if (callStateRef.current === 'active' || callStateRef.current === 'ringing') return;

            // If we're also calling, the lower socket ID accepts (tie-break)
            if (callStateRef.current === 'calling') {
                // Both calling at once — one should accept automatically
                return;
            }

            setIncomingCall({ fromSocketId, alias, callType: type });
            incomingCallRef.current = { fromSocketId, alias, callType: type };
            setCallState('ringing');
            callStateRef.current = 'ringing';

            // Play incoming ringtone
            playRingtoneRef.current?.('incoming');

            // Auto-decline after 30s
            ringTimeoutRef.current = setTimeout(() => {
                if (callStateRef.current === 'ringing') {
                    stopRingtoneRef.current?.();
                    socket.emit('call-decline', { toSocketId: fromSocketId, roomId });
                    setIncomingCall(null);
                    incomingCallRef.current = null;
                    setCallState('idle');
                    callStateRef.current = 'idle';
                }
            }, 30000);
        };

        // Our call was accepted
        const handleCallAccepted = async ({ fromSocketId, alias }) => {
            console.log('✅ call-accepted from', alias);
            stopRingtoneRef.current?.();
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            setCallState('active');
            callStateRef.current = 'active';

            // Now create peer connection and send offer directly to the peer who accepted
            const pc = createPeerConnection(fromSocketId, alias);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                // Send directly to the accepting peer, not broadcast to room
                socket.emit('webrtc-offer-direct', { toSocketId: fromSocketId, offer: pc.localDescription });
            } catch (err) {
                console.error('Error creating offer after accept:', err);
            }
        };

        // Our call was declined
        const handleCallDeclined = ({ fromSocketId, alias }) => {
            console.log('❌ call-declined from', alias);
            stopRingtoneRef.current?.();
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            setCallError(`${alias || 'User'} declined the call.`);
            setTimeout(() => setCallError(''), 4000);

            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            setLocalStream(null);
            setCallState('idle');
            callStateRef.current = 'idle';
        };

        // Caller cancelled
        const handleCallCancelled = ({ alias }) => {
            console.log('🚫 call-cancelled from', alias);
            stopRingtoneRef.current?.();
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            setIncomingCall(null);
            incomingCallRef.current = null;
            if (callStateRef.current === 'ringing') {
                setCallState('idle');
                callStateRef.current = 'idle';
            }
        };

        // Peer ended call
        const handleCallEnded = ({ fromSocketId }) => {
            stopRingtoneRef.current?.();
            cleanupPeer(fromSocketId);
            // End our call too
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            localStreamRef.current = null;
            setLocalStream(null);
            peerConnections.current.forEach(pc => pc.close());
            peerConnections.current.clear();
            setRemoteStreams(new Map());
            setCallState('idle');
            callStateRef.current = 'idle';
        };

        // WebRTC signaling
        const handleOffer = async ({ offer, fromSocketId, fromAlias }) => {
            // Only reject if we're completely idle (not in any call state)
            if (callStateRef.current === 'idle' && !localStreamRef.current) return;
            const pc = createPeerConnection(fromSocketId, fromAlias);
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('webrtc-answer', { toSocketId: fromSocketId, answer: pc.localDescription });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        };

        const handleAnswer = async ({ answer, fromSocketId }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error('Error setting remote desc:', err);
                }
            }
        };

        const handleIceCandidate = async ({ candidate, fromSocketId }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch { }
            } else {
                if (!pendingCandidates.current.has(fromSocketId)) {
                    pendingCandidates.current.set(fromSocketId, []);
                }
                pendingCandidates.current.get(fromSocketId).push(candidate);
            }
        };

        const handleMediaToggle = ({ fromSocketId, kind, enabled }) => {
            setRemoteStreams(prev => {
                const next = new Map(prev);
                const existing = next.get(fromSocketId);
                if (existing) {
                    next.set(fromSocketId, {
                        ...existing,
                        [kind === 'audio' ? 'audioEnabled' : 'videoEnabled']: enabled
                    });
                }
                return next;
            });
        };

        const handlePeerDisconnected = ({ fromSocketId }) => {
            cleanupPeer(fromSocketId);
        };

        socket.on('call-invite', handleCallInvite);
        socket.on('call-accepted', handleCallAccepted);
        socket.on('call-declined', handleCallDeclined);
        socket.on('call-cancelled', handleCallCancelled);
        socket.on('call-ended', handleCallEnded);
        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);
        socket.on('peer-media-toggle', handleMediaToggle);
        socket.on('peer-disconnected', handlePeerDisconnected);

        return () => {
            socket.off('call-invite', handleCallInvite);
            socket.off('call-accepted', handleCallAccepted);
            socket.off('call-declined', handleCallDeclined);
            socket.off('call-cancelled', handleCallCancelled);
            socket.off('call-ended', handleCallEnded);
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
            socket.off('peer-media-toggle', handleMediaToggle);
            socket.off('peer-disconnected', handlePeerDisconnected);
        };
        // Only depend on socketRef, roomId, and socketReady — use refs for all mutable state
    }, [socketRef, roomId, socketReady, createPeerConnection, cleanupPeer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (ringTimeoutRef.current) clearTimeout(ringTimeoutRef.current);
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            peerConnections.current.forEach(pc => pc.close());
        };
    }, []);

    return {
        localStream,
        remoteStreams,
        callState,
        callType,
        isMicOn,
        isCameraOn,
        callError,
        incomingCall,
        startCall,
        cancelCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCamera,
    };
}
