import { useState, useEffect, useRef, useCallback } from 'react';
import { AUDIO_VOLUME_KEY } from '../constants';
import * as sounds from '../assets/sounds';

type SoundName = keyof typeof sounds;

const useAudio = () => {
    const audioCtxRef = useRef<AudioContext | null>(null);
    const gainNodeRef = useRef<GainNode | null>(null);
    const audioBuffersRef = useRef<Record<string, AudioBuffer>>({});
    const backgroundSourceRef = useRef<AudioBufferSourceNode | null>(null);

    const [isInitialized, setIsInitialized] = useState(false);
    const [volume, setVolumeState] = useState(() => {
        const savedVolume = localStorage.getItem(AUDIO_VOLUME_KEY);
        return savedVolume ? parseFloat(savedVolume) : 0.5; // Default volume is 50%
    });

    const playBackgroundMusic = useCallback(() => {
        if (backgroundSourceRef.current) {
            try {
                backgroundSourceRef.current.stop();
            } catch (e) {
                // Could be already stopped
            }
        }
        
        const audioCtx = audioCtxRef.current;
        const gainNode = gainNodeRef.current;
        const buffer = audioBuffersRef.current['background'];
        
        if (audioCtx && gainNode && buffer && audioCtx.state === 'running') {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.loop = true;
            source.connect(gainNode);
            source.start(0);
            backgroundSourceRef.current = source;
        }
    }, []);

    const initializeAudio = useCallback(async () => {
        if (isInitialized || !window.AudioContext) return;

        const context = new window.AudioContext();
        // Check if context needs to be resumed (for autoplay policies)
        if (context.state === 'suspended') {
            await context.resume();
        }
        
        const gainNode = context.createGain();
        gainNode.gain.value = volume;
        gainNode.connect(context.destination);

        audioCtxRef.current = context;
        gainNodeRef.current = gainNode;

        await Promise.all(
            Object.entries(sounds).map(async ([name, base64]) => {
                try {
                    const response = await fetch(`data:audio/wav;base64,${base64}`);
                    const arrayBuffer = await response.arrayBuffer();
                    const audioBuffer = await context.decodeAudioData(arrayBuffer);
                    audioBuffersRef.current[name] = audioBuffer;
                } catch (error) {
                    console.error(`Failed to decode audio: ${name}`, error);
                }
            })
        );
        setIsInitialized(true);
        playBackgroundMusic();
    }, [isInitialized, volume, playBackgroundMusic]);

    const playSound = useCallback((name: SoundName) => {
        if (!isInitialized) {
            return;
        }
        const audioCtx = audioCtxRef.current;
        const gainNode = gainNodeRef.current;
        const buffer = audioBuffersRef.current[name];

        if (audioCtx && gainNode && buffer && audioCtx.state === 'running') {
            const source = audioCtx.createBufferSource();
            source.buffer = buffer;
            source.connect(gainNode);
            source.start(0);
        }
    }, [isInitialized]);

    const setVolume = useCallback((newVolume: number) => {
        const clampedVolume = Math.max(0, Math.min(1, newVolume));
        setVolumeState(clampedVolume);
        localStorage.setItem(AUDIO_VOLUME_KEY, clampedVolume.toString());
        if (gainNodeRef.current && audioCtxRef.current) {
            gainNodeRef.current.gain.setValueAtTime(clampedVolume, audioCtxRef.current.currentTime);
        }
    }, []);
    
    // Fix: Replaced event listener logic to be compatible with older TypeScript DOM library definitions
    // that do not support the `{ once: true }` option, which was causing compilation errors.
    useEffect(() => {
        const init = () => {
            initializeAudio();
            // Since this function is only meant to run once, we remove both listeners
            // immediately after the first interaction (click or keydown).
            window.removeEventListener('click', init);
            window.removeEventListener('keydown', init);
        };
        window.addEventListener('click', init);
        window.addEventListener('keydown', init);

        return () => {
            // Cleanup function to remove listeners if the component unmounts before
            // any user interaction.
            window.removeEventListener('click', init);
            window.removeEventListener('keydown', init);
        }
    }, [initializeAudio]);

    return { playSound, setVolume, volume };
};

export default useAudio;
