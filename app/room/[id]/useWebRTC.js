'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

// Call states: idle → calling (outgoing) / ringing (incoming) → active → idle
export function useWebRTC(socketRef, roomId) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map());
    const [callState, setCallState] = useState('idle'); // idle | calling | ringing | active
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [callError, setCallError] = useState('');
    const [incomingCall, setIncomingCall] = useState(null); // { fromSocketId, alias, callType }
    const [callType, setCallType] = useState('video'); // video | voice

    const peerConnections = useRef(new Map());
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef(new Map());
    const ringtoneRef = useRef(null);
    const ringTimeoutRef = useRef(null);

    // Play ringing sound
    const playRingtone = useCallback(() => {
        try {
            // Create a simple ringing tone using Web Audio API
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioCtx.createOscillator();
            const gainNode = audioCtx.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioCtx.destination);
            oscillator.frequency.value = 440;
            oscillator.type = 'sine';
            gainNode.gain.value = 0.1;

            // Ring pattern: on 1s, off 2s
            const ringInterval = setInterval(() => {
                oscillator.frequency.value = 440;
                gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
                gainNode.gain.setValueAtTime(0, audioCtx.currentTime + 1);
            }, 3000);

            oscillator.start();
            ringtoneRef.current = { audioCtx, oscillator, gainNode, ringInterval };
        } catch { }
    }, []);

    const stopRingtone = useCallback(() => {
        if (ringtoneRef.current) {
            const { audioCtx, oscillator, ringInterval } = ringtoneRef.current;
            clearInterval(ringInterval);
            try { oscillator.stop(); } catch { }
            try { audioCtx.close(); } catch { }
            ringtoneRef.current = null;
        }
        if (ringTimeoutRef.current) {
            clearTimeout(ringTimeoutRef.current);
            ringTimeoutRef.current = null;
        }
    }, []);

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
            return peerConnections.current.get(remoteSocketId);
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

    // Get media stream
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

    // Initiate a call — send invite to room, wait for accept
    const startCall = useCallback(async (videoEnabled = true) => {
        try {
            setCallError('');
            const type = videoEnabled ? 'video' : 'voice';
            setCallType(type);
            setCallState('calling');

            // Get local media first so we're ready when accepted
            const stream = await getMediaStream(videoEnabled);
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setIsCameraOn(videoEnabled);

            // Send call invite to everyone in the room
            socketRef.current?.emit('call-invite', { roomId, callType: type });

            // Auto-cancel after 30s if no one answers
            ringTimeoutRef.current = setTimeout(() => {
                if (callState === 'calling') {
                    cancelCall();
                }
            }, 30000);

        } catch (err) {
            setCallState('idle');
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
        socketRef.current?.emit('call-cancel', { roomId });

        localStreamRef.current?.getTracks().forEach(t => t.stop());
        localStreamRef.current = null;
        setLocalStream(null);
        setCallState('idle');
        setCallType('video');
    }, [socketRef, roomId, stopRingtone]);

    // Accept incoming call
    const acceptCall = useCallback(async () => {
        if (!incomingCall) return;

        stopRingtone();
        const { fromSocketId, alias, callType: type } = incomingCall;

        try {
            setCallType(type);
            const withVideo = type === 'video';

            // Get local media
            const stream = await getMediaStream(withVideo);
            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsMicOn(true);
            setIsCameraOn(withVideo);
            setCallState('active');
            setIncomingCall(null);

            // Notify the caller that we accepted
            socketRef.current?.emit('call-accept', {
                toSocketId: fromSocketId,
                roomId
            });

            // Create peer connection and send offer
            const pc = createPeerConnection(fromSocketId, alias);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socketRef.current?.emit('webrtc-offer', {
                roomId,
                offer: pc.localDescription
            });

        } catch (err) {
            setCallState('idle');
            setIncomingCall(null);
            setCallError('Failed to accept call.');
        }
    }, [incomingCall, socketRef, roomId, getMediaStream, createPeerConnection, stopRingtone]);

    // Decline incoming call
    const declineCall = useCallback(() => {
        stopRingtone();
        if (incomingCall) {
            socketRef.current?.emit('call-decline', {
                toSocketId: incomingCall.fromSocketId,
                roomId
            });
        }
        setIncomingCall(null);
        setCallState('idle');
    }, [incomingCall, socketRef, roomId, stopRingtone]);

    // End active call
    const endCall = useCallback(() => {
        stopRingtone();
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        peerConnections.current.forEach(pc => pc.close());
        peerConnections.current.clear();
        pendingCandidates.current.clear();

        setRemoteStreams(new Map());
        setCallState('idle');
        setIsMicOn(true);
        setIsCameraOn(true);
        setIncomingCall(null);

        socketRef.current?.emit('call-ended', { roomId });
    }, [socketRef, roomId, stopRingtone]);

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

    // Socket listeners
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        // Incoming call invite
        const handleCallInvite = ({ fromSocketId, alias, callType: type }) => {
            // Ignore if already in a call
            if (callState === 'active' || callState === 'calling') return;

            setIncomingCall({ fromSocketId, alias, callType: type });
            setCallState('ringing');
            playRingtone();

            // Auto-decline after 30s
            ringTimeoutRef.current = setTimeout(() => {
                setIncomingCall(null);
                setCallState('idle');
                stopRingtone();
                socket.emit('call-decline', { toSocketId: fromSocketId, roomId });
            }, 30000);
        };

        // Our call was accepted
        const handleCallAccepted = ({ fromSocketId, alias }) => {
            stopRingtone();
            setCallState('active');
        };

        // Our call was declined
        const handleCallDeclined = ({ fromSocketId, alias }) => {
            stopRingtone();
            setCallError(`${alias || 'User'} declined the call.`);
            setTimeout(() => setCallError(''), 4000);

            // If no one else is in the call, end it
            if (remoteStreams.size === 0) {
                localStreamRef.current?.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
                setLocalStream(null);
                setCallState('idle');
            }
        };

        // Caller cancelled
        const handleCallCancelled = ({ alias }) => {
            stopRingtone();
            setIncomingCall(null);
            if (callState === 'ringing') {
                setCallState('idle');
            }
        };

        // Peer ended call
        const handleCallEnded = ({ fromSocketId }) => {
            cleanupPeer(fromSocketId);
            if (remoteStreams.size <= 1) {
                // Last remote peer left, end our call too
                stopRingtone();
                localStreamRef.current?.getTracks().forEach(t => t.stop());
                localStreamRef.current = null;
                setLocalStream(null);
                peerConnections.current.forEach(pc => pc.close());
                peerConnections.current.clear();
                setRemoteStreams(new Map());
                setCallState('idle');
            }
        };

        // WebRTC signaling handlers
        const handleOffer = async ({ offer, fromSocketId, fromAlias }) => {
            if (!localStreamRef.current) return;
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
                    console.error('Error setting remote description:', err);
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
    }, [socketRef, roomId, callState, remoteStreams, createPeerConnection, cleanupPeer, playRingtone, stopRingtone]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            stopRingtone();
            localStreamRef.current?.getTracks().forEach(t => t.stop());
            peerConnections.current.forEach(pc => pc.close());
        };
    }, [stopRingtone]);

    return {
        localStream,
        remoteStreams,
        callState,     // idle | calling | ringing | active
        callType,      // video | voice
        isMicOn,
        isCameraOn,
        callError,
        incomingCall,  // { fromSocketId, alias, callType }
        startCall,
        cancelCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCamera,
    };
}
