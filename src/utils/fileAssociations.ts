// Map file extensions to their associated app IDs
export const getAppForExtension = (filename: string): string | null => {
    const ext = filename.split('.').pop()?.toLowerCase();

    if (!ext) return null;

    // Audio files -> Music
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
        return 'music';
    }

    // Text/code files -> Notepad
    if (['txt', 'md', 'json', 'js', 'ts', 'tsx', 'css', 'html', 'htm'].includes(ext)) {
        return 'notepad';
    }

    // Image files -> Photos
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return 'photos';
    }

    return null;
};

// Determine the appropriate folder based on file type/extension
export const getCategoryFolderForFile = (filename: string, homePath: string): string | null => {
    const ext = filename.split('.').pop()?.toLowerCase();
    
    if (!ext) return null;

    // Audio files -> Music folder
    if (['mp3', 'wav', 'flac', 'ogg', 'm4a'].includes(ext)) {
        return `${homePath}/Music`;
    }

    // Image files -> Photos folder
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) {
        return `${homePath}/Pictures`;
    }

    // Video files -> Videos folder
    if (['mp4', 'mkv', 'avi', 'mov', 'flv', 'wmv', 'webm'].includes(ext)) {
        return `${homePath}/Videos`;
    }

    // Document files -> Documents folder
    if (['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext)) {
        return `${homePath}/Documents`;
    }

    // Default for other files -> no auto-categorization
    return null;
};
