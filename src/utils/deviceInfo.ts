/**
 * Device Information Utilities
 * Detects device RAM and other hardware info
 */

/**
 * Get the device's total RAM in GB
 * Works on Android, iOS, and desktop browsers
 */
export async function getDeviceTotalRAM(): Promise<number> {
    // Method 1: navigator.deviceMemory (Chrome, some Android browsers)
    const navAny = navigator as any;
    if (navAny.deviceMemory && navAny.deviceMemory > 0) {
        return navAny.deviceMemory;
    }

    // Method 2: Estimate from available memory + heuristics
    // On Android, the browser's available memory is usually ~10-20% of total RAM
    // This is a reasonable estimate
    if (!navAny.deviceMemory) {
        // Estimate based on typical Android device configurations
        // Most modern devices have: 4GB, 6GB, 8GB, 12GB, 16GB
        
        // Try to get approximate total memory through performance API
        const perfAny = performance as any;
        if (perfAny.memory && perfAny.memory.jsHeapSizeLimit) {
            // JS heap limit is usually ~256-512MB on Android
            // Estimate: If heap is ~256MB, device probably has 4GB
            // If heap is ~512MB, device probably has 8GB+
            const heapLimit = perfAny.memory.jsHeapSizeLimit / (1024 * 1024); // Convert to MB
            
            if (heapLimit > 400) {
                return 8; // Large heap = 8GB+ device
            } else if (heapLimit > 300) {
                return 6; // Medium heap = 6GB device
            } else {
                return 4; // Standard heap = 4GB device
            }
        }
    }

    // Method 3: Check if we're on Android and try typical configurations
    const userAgent = navigator.userAgent.toLowerCase();
    if (userAgent.includes('android')) {
        // Android 12+ devices typically have 6GB+
        // Android 11 devices typically have 4-6GB
        // Older Android versions typically have 4GB
        
        // Check Android version from user agent
        const androidMatch = userAgent.match(/android\s+([\d.]+)/);
        if (androidMatch) {
            const androidVersion = parseInt(androidMatch[1].split('.')[0]);
            if (androidVersion >= 13) {
                return 8; // Android 13+ is usually 8GB+
            } else if (androidVersion >= 12) {
                return 6; // Android 12 is usually 6GB
            } else if (androidVersion >= 11) {
                return 6; // Android 11 is usually 6GB
            }
        }
        
        // Default guess for Android
        return 6;
    }

    // Default fallback
    return 2;
}
