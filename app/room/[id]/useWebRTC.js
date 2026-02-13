'use client';
import { useState, useRef, useCallback, useEffect } from 'react';

const ICE_SERVERS = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun2.l.google.com:19302' },
    ]
};

export function useWebRTC(socketRef, roomId) {
    const [localStream, setLocalStream] = useState(null);
    const [remoteStreams, setRemoteStreams] = useState(new Map()); // socketId -> { stream, alias, audioEnabled, videoEnabled }
    const [isCallActive, setIsCallActive] = useState(false);
    const [isMicOn, setIsMicOn] = useState(true);
    const [isCameraOn, setIsCameraOn] = useState(true);
    const [callError, setCallError] = useState('');

    const peerConnections = useRef(new Map()); // socketId -> RTCPeerConnection
    const localStreamRef = useRef(null);
    const pendingCandidates = useRef(new Map()); // socketId -> ICECandidate[]

    // Clean up a single peer connection
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

    // Create a new peer connection for a remote peer
    const createPeerConnection = useCallback((remoteSocketId, remoteAlias) => {
        if (peerConnections.current.has(remoteSocketId)) {
            return peerConnections.current.get(remoteSocketId);
        }

        const pc = new RTCPeerConnection(ICE_SERVERS);

        // Add local tracks to the connection
        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach(track => {
                pc.addTrack(track, localStreamRef.current);
            });
        }

        // Handle incoming remote tracks
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

        // Handle ICE candidates
        pc.onicecandidate = (event) => {
            if (event.candidate) {
                socketRef.current?.emit('webrtc-ice-candidate', {
                    toSocketId: remoteSocketId,
                    candidate: event.candidate,
                });
            }
        };

        // Connection state monitoring
        pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
                cleanupPeer(remoteSocketId);
            }
        };

        peerConnections.current.set(remoteSocketId, pc);

        // Add any pending ICE candidates
        const pending = pendingCandidates.current.get(remoteSocketId) || [];
        pending.forEach(candidate => {
            pc.addIceCandidate(new RTCIceCandidate(candidate)).catch(() => { });
        });
        pendingCandidates.current.delete(remoteSocketId);

        return pc;
    }, [socketRef, cleanupPeer]);

    // Start the call — get media and signal others
    const startCall = useCallback(async (videoEnabled = true) => {
        try {
            setCallError('');
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: videoEnabled ? {
                    width: { ideal: 640 },
                    height: { ideal: 480 },
                    frameRate: { ideal: 24 }
                } : false
            });

            localStreamRef.current = stream;
            setLocalStream(stream);
            setIsCallActive(true);
            setIsMicOn(true);
            setIsCameraOn(videoEnabled);

            // Notify others in the room
            socketRef.current?.emit('call-started', { roomId });
        } catch (err) {
            console.error('Failed to get media:', err);
            if (err.name === 'NotAllowedError') {
                setCallError('Camera/mic permission denied. Please allow access and try again.');
            } else if (err.name === 'NotFoundError') {
                setCallError('No camera or microphone found.');
            } else {
                setCallError('Failed to start call. Please check your devices.');
            }
        }
    }, [socketRef, roomId]);

    // End the call
    const endCall = useCallback(() => {
        // Stop local tracks
        localStreamRef.current?.getTracks().forEach(track => track.stop());
        localStreamRef.current = null;
        setLocalStream(null);

        // Close all peer connections
        peerConnections.current.forEach((pc, id) => {
            pc.close();
        });
        peerConnections.current.clear();
        pendingCandidates.current.clear();

        setRemoteStreams(new Map());
        setIsCallActive(false);
        setIsMicOn(true);
        setIsCameraOn(true);
    }, []);

    // Toggle microphone
    const toggleMic = useCallback(() => {
        if (!localStreamRef.current) return;
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            setIsMicOn(audioTrack.enabled);
            socketRef.current?.emit('toggle-media', {
                roomId,
                kind: 'audio',
                enabled: audioTrack.enabled
            });
        }
    }, [socketRef, roomId]);

    // Toggle camera
    const toggleCamera = useCallback(() => {
        if (!localStreamRef.current) return;
        const videoTrack = localStreamRef.current.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            setIsCameraOn(videoTrack.enabled);
            socketRef.current?.emit('toggle-media', {
                roomId,
                kind: 'video',
                enabled: videoTrack.enabled
            });
        }
    }, [socketRef, roomId]);

    // Set up socket listeners for WebRTC signaling
    useEffect(() => {
        const socket = socketRef.current;
        if (!socket) return;

        // When another user starts a call, create offer to them
        const handleCallStarted = async ({ fromSocketId, alias }) => {
            if (!localStreamRef.current) return; // Only connect if we're also in a call

            const pc = createPeerConnection(fromSocketId, alias);
            try {
                const offer = await pc.createOffer();
                await pc.setLocalDescription(offer);
                socket.emit('webrtc-offer', {
                    roomId,
                    offer: pc.localDescription
                });
            } catch (err) {
                console.error('Error creating offer:', err);
            }
        };

        // Receive an offer from a peer
        const handleOffer = async ({ offer, fromSocketId, fromAlias }) => {
            if (!localStreamRef.current) return;

            const pc = createPeerConnection(fromSocketId, fromAlias);
            try {
                await pc.setRemoteDescription(new RTCSessionDescription(offer));
                const answer = await pc.createAnswer();
                await pc.setLocalDescription(answer);
                socket.emit('webrtc-answer', {
                    toSocketId: fromSocketId,
                    answer: pc.localDescription
                });
            } catch (err) {
                console.error('Error handling offer:', err);
            }
        };

        // Receive an answer from a peer
        const handleAnswer = async ({ answer, fromSocketId, fromAlias }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc) {
                try {
                    await pc.setRemoteDescription(new RTCSessionDescription(answer));
                } catch (err) {
                    console.error('Error setting remote description:', err);
                }
            }
        };

        // Receive ICE candidate
        const handleIceCandidate = async ({ candidate, fromSocketId }) => {
            const pc = peerConnections.current.get(fromSocketId);
            if (pc && pc.remoteDescription) {
                try {
                    await pc.addIceCandidate(new RTCIceCandidate(candidate));
                } catch (err) {
                    console.error('Error adding ICE candidate:', err);
                }
            } else {
                // Queue candidates until remote description is set
                if (!pendingCandidates.current.has(fromSocketId)) {
                    pendingCandidates.current.set(fromSocketId, []);
                }
                pendingCandidates.current.get(fromSocketId).push(candidate);
            }
        };

        // Peer toggled media
        const handleMediaToggle = ({ fromSocketId, alias, kind, enabled }) => {
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

        // Peer disconnected
        const handlePeerDisconnected = ({ fromSocketId }) => {
            cleanupPeer(fromSocketId);
        };

        socket.on('call-started', handleCallStarted);
        socket.on('webrtc-offer', handleOffer);
        socket.on('webrtc-answer', handleAnswer);
        socket.on('webrtc-ice-candidate', handleIceCandidate);
        socket.on('peer-media-toggle', handleMediaToggle);
        socket.on('peer-disconnected', handlePeerDisconnected);

        return () => {
            socket.off('call-started', handleCallStarted);
            socket.off('webrtc-offer', handleOffer);
            socket.off('webrtc-answer', handleAnswer);
            socket.off('webrtc-ice-candidate', handleIceCandidate);
            socket.off('peer-media-toggle', handleMediaToggle);
            socket.off('peer-disconnected', handlePeerDisconnected);
        };
    }, [socketRef, roomId, createPeerConnection, cleanupPeer]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            endCall();
        };
    }, [endCall]);

    return {
        localStream,
        remoteStreams,
        isCallActive,
        isMicOn,
        isCameraOn,
        callError,
        startCall,
        endCall,
        toggleMic,
        toggleCamera,
    };
}
