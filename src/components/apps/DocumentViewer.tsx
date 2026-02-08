import { useState, useEffect, useRef } from 'react';
import {
    FileText, ZoomIn, ZoomOut, RotateCw,
    Download, FolderOpen, FileSearch,
    ChevronLeft, ChevronRight, Loader2,
    FileEdit
} from 'lucide-react';
import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import * as docx from 'docx-preview';
import { AppTemplate } from '@/components/apps/AppTemplate';
import { useFileSystem } from '@/components/FileSystemContext';
import { useAppContext } from '@/components/AppContext';
import { useI18n } from '@/i18n/index';
import { fileStorage } from '@/services/fileStorage';
import { notify } from '@/services/notifications';
import { useWindow } from '@/components/WindowContext';
import { FilePicker } from '@/components/ui/FilePicker';
import { EmptyState } from '@/components/ui/empty-state';
import { Button } from '@/components/ui/button';
import { formatBytes } from '@/utils/memory';

// Configure PDF.js worker using CDN for reliability on Android/Capacitor
pdfjs.GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

// Import styles for react-pdf
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';

interface DocumentViewerProps {
    owner?: string;
    initialPath?: string;
}

export function DocumentViewer({ owner, initialPath }: DocumentViewerProps) {
    const { t } = useI18n();
    const { getNodeAtPath } = useFileSystem();
    const { activeUser: desktopUser } = useAppContext();
    const activeUser = owner || desktopUser;
    const windowContext = useWindow();
    const docxContainerRef = useRef<HTMLDivElement>(null);

    const [currentPath, setCurrentPath] = useState<string | null>(initialPath || windowContext?.data?.path || null);
    const [fileUrl, setFileUrl] = useState<string | null>(null);
    const [fileType, setFileType] = useState<'pdf' | 'docx' | null>(null);
    const [numPages, setNumPages] = useState<number | null>(null);
    const [pageNumber, setPageNumber] = useState(1);
    const [zoom, setZoom] = useState(1.0);
    const [rotation, setRotation] = useState(0);
    const [showFilePicker, setShowFilePicker] = useState(false);
    const [docInfo, setDocInfo] = useState<{ name: string; size: number } | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Detect file type and load URL when path changes
    useEffect(() => {
        const loadFile = async () => {
            const path = currentPath || initialPath || windowContext?.data?.path;
            if (!path) {
                setFileUrl(null);
                setFileType(null);
                setDocInfo(null);
                return;
            }

            const node = getNodeAtPath(path, activeUser);
            if (node && node.type === 'file') {
                try {
                    setIsLoading(true);
                    const ext = node.name.split('.').pop()?.toLowerCase();
                    const type = ext === 'pdf' ? 'pdf' : ext === 'docx' ? 'docx' : null;

                    if (!type) {
                        notify.system('error', 'Document Viewer', t('documentViewer.toasts.unsupportedFormat'));
                        return;
                    }

                    const url = await fileStorage.getFileUrl(node);
                    setFileUrl(url);
                    setFileType(type);
                    setDocInfo({
                        name: node.name,
                        size: node.size || (node.content ? new Blob([node.content]).size : 0)
                    });
                    setCurrentPath(path);
                    setPageNumber(1);

                    // If it's a DOCX, we'll render it once the container is available
                    if (type === 'docx') {
                        renderDocx(url);
                    }
                } catch (error) {
                    console.error('Failed to load document:', error);
                    notify.system('error', 'Document Viewer', t('documentViewer.toasts.failedToLoad'));
                } finally {
                    setIsLoading(false);
                }
            }
        };

        loadFile();
    }, [currentPath, initialPath, windowContext?.data, activeUser, getNodeAtPath, t]);

    const renderDocx = async (url: string) => {
        if (!docxContainerRef.current) {
            // Wait for next tick if container isn't ready
            setTimeout(() => renderDocx(url), 50);
            return;
        }

        try {
            const response = await fetch(url);
            const blob = await response.blob();
            docxContainerRef.current.innerHTML = '';
            await docx.renderAsync(blob, docxContainerRef.current, undefined, {
                className: 'aurora-docx-content',
                inWrapper: false,
                ignoreWidth: false,
                ignoreHeight: false,
                debug: false
            });
        } catch (error) {
            console.error('DOCX Rendering failed:', error);
        }
    };

    const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
        setNumPages(numPages);
    };

    const handleZoomIn = () => setZoom(prev => Math.min(prev + 0.2, 3));
    const handleZoomOut = () => setZoom(prev => Math.max(prev - 0.2, 0.5));
    const handleRotate = () => setRotation(prev => (prev + 90) % 360);

    const handleFileSelect = (path: string) => {
        setCurrentPath(path);
        setShowFilePicker(false);
    };

    const sidebar = {
        sections: [
            {
                title: t('documentViewer.sidebar.documentInfo'),
                items: [
                    {
                        id: 'info',
                        label: docInfo?.name || t('documentViewer.title'),
                        icon: fileType === 'pdf' ? FileText : FileEdit,
                        badge: docInfo ? formatBytes(docInfo.size) : undefined
                    },
                    {
                        id: 'pages',
                        label: numPages ? t('documentViewer.sidebar.pagesCount', { count: numPages }) : t('documentViewer.sidebar.pages'),
                        icon: FileSearch,
                    }
                ]
            }
        ]
    };

    const toolbar = (
        <div className="flex items-center gap-2 px-1">
            <button
                onClick={() => setShowFilePicker(true)}
                className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                title={t('documentViewer.actions.openFile')}
            >
                <FolderOpen className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-white/10 mx-1" />

            {fileType === 'pdf' && (
                <div className="flex items-center gap-1 bg-white/5 rounded-md px-1">
                    <button
                        onClick={() => setPageNumber(prev => Math.max(prev - 1, 1))}
                        disabled={!fileUrl || pageNumber <= 1}
                        className="p-1 text-white/70 hover:text-white disabled:opacity-30"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[10px] text-white/50 min-w-[40px] text-center font-mono">
                        {pageNumber} / {numPages || '--'}
                    </span>
                    <button
                        onClick={() => setPageNumber(prev => Math.min(prev + 1, numPages || prev))}
                        disabled={!fileUrl || (numPages !== null && pageNumber >= numPages)}
                        className="p-1 text-white/70 hover:text-white disabled:opacity-30"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            )}

            <div className="w-px h-4 bg-white/10 mx-1" />
            <button
                onClick={handleZoomOut}
                disabled={!fileUrl}
                className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                title={t('documentViewer.actions.zoomOut')}
            >
                <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-[10px] text-white/50 w-8 text-center font-mono">
                {Math.round(zoom * 100)}%
            </span>
            <button
                onClick={handleZoomIn}
                disabled={!fileUrl}
                className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                title={t('documentViewer.actions.zoomIn')}
            >
                <ZoomIn className="w-4 h-4" />
            </button>
            {fileType === 'pdf' && (
                <>
                    <div className="w-px h-4 bg-white/10 mx-1" />
                    <button
                        onClick={handleRotate}
                        disabled={!fileUrl}
                        className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30"
                        title={t('documentViewer.actions.rotate')}
                    >
                        <RotateCw className="w-4 h-4" />
                    </button>
                </>
            )}
            <div className="ml-auto flex items-center gap-2">
                {fileUrl && (
                    <a
                        href={fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-1.5 rounded-md text-white/70 hover:text-white hover:bg-white/10 transition-colors"
                        title={t('documentViewer.actions.download')}
                    >
                        <Download className="w-4 h-4" />
                    </a>
                )}
            </div>
        </div>
    );

    const renderContent = () => {
        if (!fileUrl) {
            return (
                <EmptyState
                    icon={FileText}
                    title={t('documentViewer.empty.title')}
                    description={t('documentViewer.empty.description')}
                    action={
                        <Button onClick={() => setShowFilePicker(true)} variant="outline" className="border-white/20 text-white hover:bg-white/10">
                            {t('documentViewer.actions.openFile')}
                        </Button>
                    }
                    className="h-full"
                />
            );
        }

        return (
            <div className="flex-1 relative overflow-auto bg-zinc-900/90 p-4 flex flex-col items-center custom-scrollbar">
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
                        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    </div>
                )}

                <div
                    className="shadow-2xl mb-8 transition-transform duration-200"
                    style={{
                        transform: fileType === 'pdf' ? `rotate(${rotation}deg)` : undefined,
                        scale: zoom !== 1.0 ? zoom : undefined
                    }}
                >
                    {fileType === 'pdf' ? (
                        <PDFDocument
                            file={fileUrl}
                            onLoadSuccess={onDocumentLoadSuccess}
                            loading={
                                <div className="flex flex-col items-center gap-4 p-20">
                                    <Loader2 className="w-8 h-8 text-white/30 animate-spin" />
                                    <span className="text-white/50 text-sm">{t('documentViewer.loading')}</span>
                                </div>
                            }
                            error={
                                <div className="p-20 text-center">
                                    <FileText className="w-12 h-12 text-red-500/50 mx-auto mb-4" />
                                    <span className="text-white/70">{t('documentViewer.toasts.failedToLoad')}</span>
                                </div>
                            }
                        >
                            <Page
                                pageNumber={pageNumber}
                                scale={1.0} // Control scale via container transform for smoothness
                                rotate={0} // Control rotation via container transform
                                className="bg-white rounded-sm overflow-hidden"
                                renderTextLayer={true}
                                renderAnnotationLayer={true}
                            />
                        </PDFDocument>
                    ) : (
                        <div
                            ref={docxContainerRef}
                            className="bg-white p-8 sm:p-12 min-h-[800px] w-full max-w-[850px] shadow-lg rounded-sm overflow-hidden text-black docx-content-viewer"
                        />
                    )}
                </div>
            </div>
        );
    };

    return (
        <div className="flex flex-col h-full overflow-hidden">
            <AppTemplate
                sidebar={sidebar}
                toolbar={toolbar}
                content={renderContent()}
                activeItem="info"
                onItemClick={() => { }}
            />

            {showFilePicker && (
                <FilePicker
                    isOpen={showFilePicker}
                    mode="open"
                    owner={activeUser}
                    onSelect={handleFileSelect}
                    onClose={() => setShowFilePicker(false)}
                    extension=".pdf,.docx"
                />
            )}
        </div>
    );
}
