import { useState, useEffect, useRef, useCallback } from 'react';
import {
    Play, Pause, Volume2, VolumeX, Maximize, Film,
    Settings, PictureInPicture, RotateCcw, RotateCw, Minimize
} from 'lucide-react';
import { AppTemplate } from '@/components/apps/AppTemplate';
import { useFileSystem } from '@/components/FileSystemContext';
import { useAppContext } from '@/components/AppContext';
import { useWindow } from '@/components/WindowContext';
import { useThemeColors } from '@/hooks/useThemeColors';
import { notify } from '@/services/notifications';
import { Slider } from '@/components/ui/slider';
import { cn } from '@/components/ui/utils';
import { EmptyState } from '@/components/ui/empty-state';
import { getSafeImageUrl } from '@/utils/urlUtils';
import { motion, AnimatePresence } from 'motion/react';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';
import type { FloatingVideoData } from '@/components/apps/FloatingVideoPlayer';

export interface VideoPlayerProps {
    owner?: string;
    initialPath?: string;
}

export function VideoPlayer({ owner, initialPath }: VideoPlayerProps) {
    const { activeUser: desktopUser, accentColor, floatingVideoData, setFloatingVideoData } = useAppContext();
    const { getNodeAtPath } = useFileSystem();
    const windowContext = useWindow();
    const { } = useThemeColors();
    const activeUser = owner || desktopUser;

    const videoRef = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const [volume, setVolume] = useState(80);
    const [currentTime, setCurrentTime] = useState(0);
    const [duration, setDuration] = useState(0);
    const [videoUrl, setVideoUrl] = useState<string | null>(null);
    const [videoName, setVideoName] = useState<string>('');
    const [playbackRate, setPlaybackRate] = useState(1);
    const [showControls, setShowControls] = useState(true);
    const [isHovering, setIsHovering] = useState(false);
    const [isFullscreen, setIsFullscreen] = useState(false);

    const controlsTimeout = useRef<NodeJS.Timeout | null>(null);

    // Handle video loading from path
    useEffect(() => {
        const path = initialPath || windowContext?.data?.path;
        const timestamp = windowContext?.data?.timestamp;
        const isFresh = timestamp && (Date.now() - timestamp < 2000);

        if (path && timestamp && isFresh) {
            const loadVideo = async () => {
                const { fileStorage } = await import('@/services/fileStorage');
                const node = getNodeAtPath(path, activeUser);

                if (node && node.type === 'file') {
                    const url = fileStorage.getFileUrl(node);
                    if (url) {
                        const safeUrl = getSafeImageUrl(url);
                        if (safeUrl) {
                            setVideoUrl(safeUrl);
                            setVideoName(node.name);
                        } else {
                            notify.system('error', 'Video Player', 'Failed to load video: Invalid URL', 'Error');
                        }
                    }
                }
            };

            loadVideo();
        }
    }, [initialPath, windowContext?.data, activeUser, getNodeAtPath]);

    // Auto-hide controls logic
    const resetControlsTimer = useCallback(() => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);

        if (isPlaying) {
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 5000);
        }
    }, [isPlaying]);

    useEffect(() => {
        resetControlsTimer();
        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        };
    }, [isPlaying, resetControlsTimer]);

    // Listen for fullscreen changes
    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullscreen(!!document.fullscreenElement);
            setShowControls(true);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, []);

    // Handle shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (!videoRef.current) return;

            // Global app shortcuts
            switch (e.key.toLowerCase()) {
                case ' ':
                    e.preventDefault();
                    handlePlayPause();
                    break;
                case 'arrowright':
                    videoRef.current.currentTime += 5;
                    break;
                case 'arrowleft':
                    videoRef.current.currentTime -= 5;
                    break;
                case 'm':
                    handleMuteToggle();
                    break;
                case 'f':
                    handleFullscreen();
                    break;
                case 'j':
                    videoRef.current.currentTime -= 10;
                    break;
                case 'l':
                    videoRef.current.currentTime += 10;
                    break;
                case 'k':
                    handlePlayPause();
                    break;
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [videoUrl]); // Re-bind if url changes

    // Video event handlers
    const handlePlayPause = useCallback(() => {
        if (!videoRef.current) return;

        if (videoRef.current.paused) {
            videoRef.current.play();
        } else {
            videoRef.current.pause();
        }
    }, []);

    const handleVolumeChange = useCallback((val: number) => {
        if (!videoRef.current) return;
        setVolume(val);
        videoRef.current.volume = val / 100;
        if (val === 0) setIsMuted(true);
        else if (isMuted) setIsMuted(false);
    }, [isMuted]);

    const handleMuteToggle = useCallback(() => {
        if (!videoRef.current) return;
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        videoRef.current.muted = newMuted;
    }, [isMuted]);

    const handleSeek = useCallback((val: number) => {
        if (!videoRef.current) return;
        videoRef.current.currentTime = val;
        setCurrentTime(val);
    }, []);

    const handleFullscreen = useCallback(() => {
        if (!containerRef.current) return;
        if (!document.fullscreenElement) {
            containerRef.current.requestFullscreen().catch(err => {
                notify.system('error', 'Fullscreen', err.message);
            });
            setIsFullscreen(true);
        } else {
            document.exitFullscreen().catch(err => {
                notify.system('error', 'Fullscreen', err.message);
            });
            setIsFullscreen(false);
        }
    }, []);

    const togglePiP = useCallback(async () => {
        if (!videoRef.current || !videoUrl) return;

        const isCurrentlyPiP = floatingVideoData !== null;

        if (isCurrentlyPiP) {
            // Exit PiP - restore to main player
            if (floatingVideoData) {
                setCurrentTime(floatingVideoData.currentTime);
                setIsPlaying(floatingVideoData.isPlaying);
                setVolume(floatingVideoData.volume);
                setIsMuted(floatingVideoData.isMuted);
                setPlaybackRate(floatingVideoData.playbackRate);
            }
            setFloatingVideoData(null);
        } else {
            // Enter PiP - create floating video and close window
            const pipData: FloatingVideoData = {
                url: videoUrl,
                name: videoName,
                currentTime: videoRef.current.currentTime,
                duration: videoRef.current.duration,
                isPlaying: isPlaying,
                volume: volume,
                isMuted: isMuted,
                playbackRate: playbackRate,
            };
            setFloatingVideoData(pipData);
            videoRef.current.pause();
            setIsPlaying(false);
            
            // Close the window after a short delay to ensure state updates
            setTimeout(() => {
                windowContext?.forceClose();
            }, 100);
        }
    }, [videoRef, videoUrl, videoName, isPlaying, volume, isMuted, playbackRate, floatingVideoData, windowContext, setFloatingVideoData]);

    const handlePlaybackRate = useCallback((rate: number) => {
        if (!videoRef.current) return;
        videoRef.current.playbackRate = rate;
        setPlaybackRate(rate);
    }, []);

    // Sync state with video element
    useEffect(() => {
        if (!videoRef.current) return;
        const video = videoRef.current;

        const sync = () => {
            setCurrentTime(video.currentTime);
            setDuration(video.duration);
            setIsPlaying(!video.paused);
        };

        video.addEventListener('timeupdate', sync);
        video.addEventListener('durationchange', sync);
        video.addEventListener('play', sync);
        video.addEventListener('pause', sync);
        video.addEventListener('ratechange', sync);
        video.addEventListener('ended', () => setIsPlaying(false));

        return () => {
            video.removeEventListener('timeupdate', sync);
            video.removeEventListener('durationchange', sync);
            video.removeEventListener('play', sync);
            video.removeEventListener('pause', sync);
            video.removeEventListener('ratechange', sync);
        };
    }, [videoUrl]);

    const formatTime = (seconds: number) => {
        if (!isFinite(seconds)) return '00:00';
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);

        if (h > 0) {
            return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        }
        return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    };

    const speedOptions = [0.5, 0.75, 1, 1.25, 1.5, 2];

    const toolbar = (
        <div className="flex items-center justify-between w-full px-2">
            <div className="flex items-center gap-2 text-white/90">
                <Film className="w-4 h-4 text-white/50" />
                <h2 className="text-sm font-medium truncate max-w-[200px]">
                    {videoName || 'Video Player'}
                </h2>
            </div>
        </div>
    );

    const content = (
        <div
            ref={containerRef}
            className={cn(
                "group relative flex flex-col h-full w-full overflow-hidden bg-black",
                isFullscreen && "z-[9998]"
            )}
            onMouseMove={resetControlsTimer}
            onTouchMove={resetControlsTimer}
            onTouchStart={resetControlsTimer}
            onMouseEnter={() => setIsHovering(true)}
            onMouseLeave={() => setIsHovering(false)}
        >
            {!videoUrl ? (
                <div className="absolute inset-0 flex items-center justify-center">
                    <EmptyState
                        icon={Film}
                        title="No Video Loaded"
                        description="Select a video file from Finder to play it here"
                    />
                </div>
            ) : (
                <>
                    {/* Main Video */}
                    <video
                        ref={videoRef}
                        src={videoUrl}
                        className="w-full h-full object-contain cursor-pointer"
                        onClick={handlePlayPause}
                        preload="metadata"
                        playsInline
                    />

                    {/* Controls Overlay */}
                    <AnimatePresence>
                        {showControls && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: 10 }}
                                transition={{ duration: 0.2 }}
                                className="absolute inset-x-0 bottom-0 pointer-events-none"
                                onMouseEnter={() => setShowControls(true)}
                                onTouchStart={() => setShowControls(true)}
                            >
                                {/* Bottom Gradient for Readability */}
                                <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />

                                {/* Floating Glass Controls Bar */}
                                <div className={cn(
                                    "relative mx-6 mb-6 p-1 rounded-2xl border border-white/10 bg-black/40 backdrop-blur-xl pointer-events-auto shadow-2xl overflow-hidden",
                                    isFullscreen && "z-[9999]"
                                )}>
                                    {/* Custom Scrubber */}
                                    <div className="px-4 pt-3 pb-1">
                                        <Slider
                                            value={[currentTime]}
                                            max={duration || 100}
                                            step={0.1}
                                            onValueChange={(vals) => handleSeek(vals[0])}
                                            className="w-full h-1.5 cursor-pointer"
                                            style={{ '--accent-color': accentColor } as any}
                                        />
                                    </div>

                                    <div className="flex items-center justify-between px-3 h-12">
                                        {/* Left: Playback controls */}
                                        <div className="flex items-center gap-1">
                                            <button
                                                onClick={() => { if (videoRef.current) videoRef.current.currentTime -= 10; }}
                                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                            >
                                                <RotateCcw className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={handlePlayPause}
                                                className="w-10 h-10 rounded-full flex items-center justify-center bg-white text-black hover:scale-105 active:scale-95 transition-all shadow-lg"
                                            >
                                                {isPlaying ? <Pause className="w-5 h-5" fill="currentColor" /> : <Play className="w-5 h-5 ml-1" fill="currentColor" />}
                                            </button>

                                            <button
                                                onClick={() => { if (videoRef.current) videoRef.current.currentTime += 10; }}
                                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                            >
                                                <RotateCw className="w-4 h-4" />
                                            </button>

                                            <div className="ml-2 text-white/80 text-[10px] sm:text-xs tabular-nums font-medium space-x-1">
                                                <span>{formatTime(currentTime)}</span>
                                                <span className="text-white/30">/</span>
                                                <span className="text-white/50">{formatTime(duration)}</span>
                                            </div>
                                        </div>

                                        {/* Right: Settings & Ext */}
                                        <div className="flex items-center gap-1">
                                            {/* Volume Block */}
                                            <div className="flex items-center group/volume mr-2">
                                                <button
                                                    onClick={handleMuteToggle}
                                                    className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                                >
                                                    {isMuted || volume === 0 ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                                                </button>
                                                <div className="w-0 group-hover/volume:w-20 overflow-hidden transition-all duration-300 ml-1">
                                                    <Slider
                                                        value={[isMuted ? 0 : volume]}
                                                        max={100}
                                                        step={1}
                                                        onValueChange={(vals) => handleVolumeChange(vals[0])}
                                                        className="w-20"
                                                        style={{ '--accent-color': accentColor } as any}
                                                    />
                                                </div>
                                            </div>

                                            {/* Settings Dropdown */}
                                            <DropdownMenu.Root>
                                                <DropdownMenu.Trigger asChild>
                                                    <button className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all relative z-[99998]">
                                                        <Settings className="w-4 h-4" />
                                                    </button>
                                                </DropdownMenu.Trigger>
                                                <DropdownMenu.Portal>
                                                    <DropdownMenu.Content
                                                        side="top"
                                                        align="end"
                                                        sideOffset={12}
                                                        avoidCollisions={false}
                                                        className="z-[100000] min-w-[120px] bg-black/90 backdrop-blur-xl border border-white/20 rounded-lg p-1 text-white shadow-2xl animate-in fade-in zoom-in-95 pointer-events-auto"
                                                    >
                                                        <DropdownMenu.Label className="px-2 py-1 text-[9px] text-white/40 uppercase font-bold tracking-wider pointer-events-none">
                                                            Speed
                                                        </DropdownMenu.Label>
                                                        {speedOptions.map(rate => (
                                                            <DropdownMenu.Item
                                                                key={rate}
                                                                onClick={() => handlePlaybackRate(rate)}
                                                                className={cn(
                                                                    "px-2 py-1 text-xs rounded cursor-pointer flex items-center justify-between transition-colors pointer-events-auto select-none",
                                                                    playbackRate === rate ? "bg-white/20 text-white" : "text-white/70 hover:bg-white/10 hover:text-white"
                                                                )}
                                                            >
                                                                {rate}x
                                                                {playbackRate === rate && <div className="w-1.5 h-1.5 rounded-full ml-2" style={{ backgroundColor: accentColor }} />}
                                                            </DropdownMenu.Item>
                                                        ))}
                                                    </DropdownMenu.Content>
                                                </DropdownMenu.Portal>
                                            </DropdownMenu.Root>

                                            <button
                                                onClick={togglePiP}
                                                className={cn(
                                                    "p-2 rounded-xl transition-all",
                                                    floatingVideoData !== null ? "text-white bg-white/10" : "text-white/70 hover:text-white hover:bg-white/10"
                                                )}
                                            >
                                                <PictureInPicture className="w-4 h-4" />
                                            </button>

                                            <button
                                                onClick={handleFullscreen}
                                                className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-xl transition-all"
                                            >
                                                {isFullscreen ? <Minimize className="w-4 h-4" /> : <Maximize className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Centered Play/Pause Feedback (Visual Polish) */}
                    <AnimatePresence>
                        {showControls && isHovering && !isPlaying && (
                            <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.8, opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center pointer-events-none"
                            >
                                <div className="p-6 rounded-full bg-black/20 backdrop-blur-sm border border-white/5">
                                    {isPlaying ? <Pause className="w-12 h-12 text-white/10" /> : <Play className="w-12 h-12 text-white/10 ml-2" />}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </>
            )}
        </div>
    );

    return (
        <>
            <AppTemplate
                toolbar={toolbar}
                content={content}
                contentClassName="flex flex-col h-full overflow-hidden"
                toolbarClassName="bg-transparent border-b-0 backdrop-blur-none absolute top-0 z-50 w-full pointer-events-none **:pointer-events-auto"
                style={{
                    background: 'transparent',
                    backgroundColor: 'black'
                }}
                minContentWidth={500}
            />
        </>
    );
}

import { AppMenuConfig } from '../../types';

export const videoPlayerMenuConfig: AppMenuConfig = {
    menus: ['File', 'Playback', 'Window', 'Help'],
    items: {
        'Playback': [
            { label: 'Play/Pause', labelKey: 'videoPlayer.menu.playPause', shortcut: 'Space', action: 'play-pause' },
            { type: 'separator' },
            { label: 'Mute', labelKey: 'videoPlayer.menu.mute', shortcut: '⌘M', action: 'mute' },
            { label: 'Fullscreen', labelKey: 'videoPlayer.menu.fullscreen', shortcut: '⌘F', action: 'fullscreen' },
        ]
    }
};

