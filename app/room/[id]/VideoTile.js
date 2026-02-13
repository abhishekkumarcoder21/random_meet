'use client';
import { useRef, useEffect } from 'react';
import styles from './room.module.css';

export function VideoTile({ stream, alias, isMe, isMuted, isCameraOff }) {
    const videoRef = useRef(null);

    useEffect(() => {
        if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
        }
    }, [stream]);

    return (
        <div className={`${styles.videoTile} ${isMe ? styles.videoTileMe : ''}`}>
            <video
                ref={videoRef}
                autoPlay
                playsInline
                muted={isMe}
                className={styles.videoElement}
            />
            {isCameraOff && (
                <div className={styles.cameraOff}>
                    <span className={styles.cameraOffIcon}>
                        {alias?.charAt(0)?.toUpperCase() || '?'}
                    </span>
                </div>
            )}
            <div className={styles.videoOverlay}>
                <span className={styles.videoAlias}>
                    {isMuted && <span className={styles.mutedIcon}>🔇</span>}
                    {isMe ? 'You' : alias || 'Anonymous'}
                </span>
            </div>
        </div>
    );
}
