import { Upload } from 'lucide-react';
import { useThemeColors } from '@/hooks/useThemeColors';

interface UploadProgressToastProps {
    fileName: string;
    progress: number; // 0-100
    fileSize: string;
}

export function UploadProgressToast({ fileName, progress, fileSize }: UploadProgressToastProps) {
    const { notificationBackground, blurStyle } = useThemeColors();

    return (
        <div
            className="w-full p-3 rounded-xl border border-white/10 shadow-2xl transition-all duration-300 pointer-events-auto select-none"
            style={{
                backgroundColor: notificationBackground,
                ...blurStyle
            }}
        >
            <div className="flex items-center gap-2.5">
                <Upload className="w-4 h-4 text-blue-400" />
                <span className="text-[13px] font-semibold text-white tracking-wide flex-1">
                    Uploading
                </span>
                <span className="text-[11px] text-white/40 font-medium">{progress}%</span>
            </div>
            <div className="text-[13px] text-white/70 leading-snug mt-1 pl-[26px] truncate">
                {fileName}
            </div>
            {/* Progress bar */}
            <div className="mt-2 ml-[26px]">
                <div className="w-full h-1.5 bg-white/10 rounded-full overflow-hidden">
                    <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-500 rounded-full transition-all duration-300"
                        style={{ width: `${progress}%` }}
                    />
                </div>
                <div className="text-[11px] text-white/50 mt-1">
                    {fileSize}
                </div>
            </div>
        </div>
    );
}
