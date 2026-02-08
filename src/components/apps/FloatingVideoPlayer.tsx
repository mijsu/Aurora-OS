import { useState, useRef, useCallback, useEffect } from 'react';
import { Play, Pause, Volume2, VolumeX, X, RotateCcw, RotateCw } from 'lucide-react';
import { motion } from 'motion/react';

export interface FloatingVideoData {
    url: string;
    name: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
    volume: number;
    isMuted: boolean;
    playbackRate: number;
}

interface FloatingVideoPlayerProps {
    data: FloatingVideoData | null;
    onClose: () => void;
    onUpdate: (data: Partial<FloatingVideoData>) => void;
}

export function FloatingVideoPlayer({ data, onClose, onUpdate }: FloatingVideoPlayerProps) {
    if (!data) return null;

    const videoRef = useRef<HTMLVideoElement>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [position, setPosition] = useState({ x: window.innerWidth - 420, y: window.innerHeight - 350 });
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [isResizing, setIsResizing] = useState(false);
    const [size, setSize] = useState({ width: 360, height: 280 });
    const [showControls, setShowControls] = useState(true);
    const [resizeEdge, setResizeEdge] = useState<string | null>(null);
    const [hoverEdge, setHoverEdge] = useState<string | null>(null);
    const windowRef = useRef<HTMLDivElement>(null);
    const controlsTimeout = useRef<NodeJS.Timeout | null>(null);
    const EDGE_SIZE = 12;

    // Sync video state with parent and auto-play
    useEffect(() => {
        if (!videoRef.current) return;
        videoRef.current.volume = data.volume / 100;
        videoRef.current.muted = data.isMuted;
        videoRef.current.playbackRate = data.playbackRate;
        
        if (data.isPlaying) {
            videoRef.current.play().catch(err => {
                console.log('Auto-play prevented:', err);
            });
        }
    }, [data.volume, data.isMuted, data.playbackRate, data.isPlaying]);

    const resetControlsTimer = useCallback(() => {
        setShowControls(true);
        if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        if (data.isPlaying) {
            controlsTimeout.current = setTimeout(() => {
                setShowControls(false);
            }, 3000);
        }
    }, [data.isPlaying]);

    useEffect(() => {
        resetControlsTimer();
        return () => {
            if (controlsTimeout.current) clearTimeout(controlsTimeout.current);
        };
    }, [data.isPlaying, resetControlsTimer]);

    const handlePlayPause = useCallback(() => {
        if (!videoRef.current) return;
        if (videoRef.current.paused) {
            videoRef.current.play();
            onUpdate({ isPlaying: true });
        } else {
            videoRef.current.pause();
            onUpdate({ isPlaying: false });
        }
        resetControlsTimer();
    }, [onUpdate, resetControlsTimer]);

    const handleWindowMouseDown = (e: React.MouseEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        
        const rect = windowRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Detect which edge is being clicked (12px from edge)
        const hitRight = x >= rect.width - EDGE_SIZE;
        const hitBottom = y >= rect.height - EDGE_SIZE;
        const hitLeft = x <= EDGE_SIZE;
        const hitTop = y <= EDGE_SIZE;
        
        if (hitRight || hitBottom || hitLeft || hitTop) {
            e.preventDefault();
            setIsResizing(true);
            let edge = '';
            if (hitTop) edge += 'top';
            if (hitBottom) edge += 'bottom';
            if (hitLeft) edge += 'left';
            if (hitRight) edge += 'right';
            setResizeEdge(edge);
            setDragStart({ x: e.clientX, y: e.clientY });
            return;
        }
        
        // Otherwise, start dragging
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    const handleWindowMouseMove = (e: React.MouseEvent) => {
        const rect = windowRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // Detect which edge the mouse is over for cursor feedback
        const hitRight = x >= rect.width - EDGE_SIZE;
        const hitBottom = y >= rect.height - EDGE_SIZE;
        const hitLeft = x <= EDGE_SIZE;
        const hitTop = y <= EDGE_SIZE;
        
        if (hitRight || hitBottom || hitLeft || hitTop) {
            let edge = '';
            if (hitTop) edge += 'top';
            if (hitBottom) edge += 'bottom';
            if (hitLeft) edge += 'left';
            if (hitRight) edge += 'right';
            setHoverEdge(edge);
        } else {
            setHoverEdge(null);
        }
    };

    const handleWindowTouchStart = (e: React.TouchEvent) => {
        if ((e.target as HTMLElement).closest('button')) return;
        const touch = e.touches[0];
        const rect = windowRef.current?.getBoundingClientRect();
        if (!rect) return;
        
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        
        const hitRight = x >= rect.width - EDGE_SIZE;
        const hitBottom = y >= rect.height - EDGE_SIZE;
        const hitLeft = x <= EDGE_SIZE;
        const hitTop = y <= EDGE_SIZE;
        
        if (hitRight || hitBottom || hitLeft || hitTop) {
            e.preventDefault();
            setIsResizing(true);
            let edge = '';
            if (hitTop) edge += 'top';
            if (hitBottom) edge += 'bottom';
            if (hitLeft) edge += 'left';
            if (hitRight) edge += 'right';
            setResizeEdge(edge);
            setDragStart({ x: touch.clientX, y: touch.clientY });
            return;
        }
        
        setIsDragging(true);
        setDragStart({ x: touch.clientX - position.x, y: touch.clientY - position.y });
    };

    const handleCloseClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onClose();
    };

    const handleMouseMove = useCallback((e: MouseEvent) => {
        if (isDragging) {
            setPosition({
                x: Math.max(0, Math.min(e.clientX - dragStart.x, window.innerWidth - 100)),
                y: Math.max(0, Math.min(e.clientY - dragStart.y, window.innerHeight - 50)),
            });
        }
        if (isResizing && resizeEdge) {
            const deltaX = e.clientX - dragStart.x;
            const deltaY = e.clientY - dragStart.y;
            
            let newWidth = size.width;
            let newHeight = size.height;
            let newX = position.x;
            let newY = position.y;
            
            // Resize from edges
            if (resizeEdge.includes('right')) newWidth = Math.max(200, size.width + deltaX);
            if (resizeEdge.includes('bottom')) newHeight = Math.max(150, size.height + deltaY);
            if (resizeEdge.includes('left')) {
                const change = Math.max(200, size.width - deltaX);
                newX = position.x + (size.width - change);
                newWidth = change;
            }
            if (resizeEdge.includes('top')) {
                const change = Math.max(150, size.height - deltaY);
                newY = position.y + (size.height - change);
                newHeight = change;
            }
            
            setSize({ width: newWidth, height: newHeight });
            setPosition({ x: newX, y: newY });
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    }, [isDragging, isResizing, dragStart, position, size, resizeEdge]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        const touch = e.touches[0];
        if (isDragging) {
            setPosition({
                x: Math.max(0, Math.min(touch.clientX - dragStart.x, window.innerWidth - 100)),
                y: Math.max(0, Math.min(touch.clientY - dragStart.y, window.innerHeight - 50)),
            });
        }
        if (isResizing && resizeEdge) {
            const deltaX = touch.clientX - dragStart.x;
            const deltaY = touch.clientY - dragStart.y;
            
            let newWidth = size.width;
            let newHeight = size.height;
            let newX = position.x;
            let newY = position.y;
            
            if (resizeEdge.includes('right')) newWidth = Math.max(200, size.width + deltaX);
            if (resizeEdge.includes('bottom')) newHeight = Math.max(150, size.height + deltaY);
            if (resizeEdge.includes('left')) {
                const change = Math.max(200, size.width - deltaX);
                newX = position.x + (size.width - change);
                newWidth = change;
            }
            if (resizeEdge.includes('top')) {
                const change = Math.max(150, size.height - deltaY);
                newY = position.y + (size.height - change);
                newHeight = change;
            }
            
            setSize({ width: newWidth, height: newHeight });
            setPosition({ x: newX, y: newY });
            setDragStart({ x: touch.clientX, y: touch.clientY });
        }
    }, [isDragging, isResizing, dragStart, position, size, resizeEdge]);

    const handleMouseUp = useCallback(() => {
        setIsDragging(false);
        setIsResizing(false);
        setResizeEdge(null);
    }, []);

    useEffect(() => {
        if (isDragging || isResizing) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
            window.addEventListener('touchmove', handleTouchMove, { passive: false });
            window.addEventListener('touchend', handleMouseUp);
            return () => {
                window.removeEventListener('mousemove', handleMouseMove);
                window.removeEventListener('mouseup', handleMouseUp);
                window.removeEventListener('touchmove', handleTouchMove);
                window.removeEventListener('touchend', handleMouseUp);
            };
        }
    }, [isDragging, isResizing, handleMouseMove, handleTouchMove, handleMouseUp]);

    const getResizeCursor = (edge: string | null) => {
        if (!edge) return null; // Return null when not on edge, so video can have its own cursor
        if (edge === 'top' || edge === 'bottom') return 'ns-resize';
        if (edge === 'left' || edge === 'right') return 'ew-resize';
        if (edge === 'topleft' || edge === 'bottomright') return 'nwse-resize';
        if (edge === 'topright' || edge === 'bottomleft') return 'nesw-resize';
        return 'default';
    };

    return (
        <motion.div
            ref={windowRef}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.3 }}
            className="fixed z-[50000] bg-black rounded-lg border border-white/20 shadow-2xl overflow-hidden flex flex-col"
            style={{
                left: `${position.x}px`,
                top: `${position.y}px`,
                width: `${size.width}px`,
                height: `${size.height}px`,
                cursor: getResizeCursor(resizeEdge || hoverEdge) || 'default',
            }}
            onMouseDown={handleWindowMouseDown}
            onMouseMove={handleWindowMouseMove}
            onTouchStart={handleWindowTouchStart}
            onTouchEnd={() => resetControlsTimer()}
            onClick={() => resetControlsTimer()}
        >
            {/* Video Container - Fill available space */}
            <div 
                className="relative flex-1 w-full bg-black/80"
                style={{
                    cursor: getResizeCursor(resizeEdge || hoverEdge) || 'default',
                }}
            >
                {/* Close button - Positioned on top of video */}
                {showControls && (
                    <button
                        onClick={handleCloseClick}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onClose();
                        }}
                        className="absolute top-2 right-2 z-10 p-1 hover:bg-white/10 rounded transition-colors flex-shrink-0"
                    >
                        <X className="w-4 h-4 text-white/70 hover:text-white" />
                    </button>
                )}
                <video
                    ref={videoRef}
                    src={data.url}
                    onTimeUpdate={() => {
                        if (videoRef.current) {
                            onUpdate({ currentTime: videoRef.current.currentTime });
                        }
                    }}
                    onDurationChange={() => {
                        if (videoRef.current) {
                            onUpdate({ duration: videoRef.current.duration });
                        }
                    }}
                    onPlay={() => onUpdate({ isPlaying: true })}
                    onPause={() => onUpdate({ isPlaying: false })}
                    onClick={handlePlayPause}
                    className="w-full h-full object-contain"
                    style={{
                        cursor: getResizeCursor(resizeEdge || hoverEdge) || 'pointer',
                    }}
                    preload="metadata"
                    playsInline
                />

                {/* Center Play Indicator */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    {!data.isPlaying && (
                        <div className="p-3 rounded-full bg-black/30 backdrop-blur-sm">
                            <Play className="w-8 h-8 text-white/40 ml-1" fill="currentColor" />
                        </div>
                    )}
                </div>
            </div>

            {/* Controls Bar - Auto-hide after 5 seconds */}
            {showControls && (
            <div className="bg-black/60 backdrop-blur px-2 py-1.5 flex items-center justify-between gap-2">
                <div className="flex items-center gap-1">
                    <button
                        onClick={handlePlayPause}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        {data.isPlaying ? (
                            <Pause className="w-3 h-3 text-white" fill="currentColor" />
                        ) : (
                            <Play className="w-3 h-3 text-white ml-0.5" fill="currentColor" />
                        )}
                    </button>

                    <button
                        onClick={() => {
                            if (videoRef.current) {
                                videoRef.current.currentTime -= 5;
                            }
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <RotateCcw className="w-3 h-3 text-white/70" />
                    </button>

                    <button
                        onClick={() => {
                            if (videoRef.current) {
                                videoRef.current.currentTime += 5;
                            }
                        }}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        <RotateCw className="w-3 h-3 text-white/70" />
                    </button>
                </div>

                <div className="flex items-center gap-1 min-w-0">
                    <span className="text-[9px] text-white/50 whitespace-nowrap">
                        {Math.floor(data.currentTime)}s
                    </span>
                    <button
                        onClick={() => onUpdate({ isMuted: !data.isMuted })}
                        className="p-1 hover:bg-white/10 rounded transition-colors"
                    >
                        {data.isMuted ? (
                            <VolumeX className="w-3 h-3 text-white/70" />
                        ) : (
                            <Volume2 className="w-3 h-3 text-white/70" />
                        )}
                    </button>
                </div>
            </div>
            )}
        </motion.div>
    );
}
