import { type ReactNode } from "react";
import { toast } from "sonner";
import { soundManager } from "@/services/sound";
import { SystemToast } from "@/components/ui/notifications/SystemToast";
import { UploadProgressToast } from "@/components/ui/notifications/UploadProgressToast";

type NotificationType = "success" | "warning" | "error";

export const notify = {
  system: (
    type: NotificationType,
    source: string,
    message: ReactNode,
    subtitle?: string,
    appId?: string,
    onOpenApp?: (appId: string) => void
  ) => {
    // Play sound
    soundManager.play(type);

    // Show toast
    toast.custom(
      () => (
        <SystemToast
          type={type}
          source={source}
          message={message}
          subtitle={subtitle}
          appId={appId}
          onOpenApp={onOpenApp}
        />
      ),
      {
        position: "bottom-right",
        duration: 4000,
      }
    );
  },
  
  uploadProgress: (fileName: string, fileSize: string) => {
    let toastId: string | number | null = null;
    let currentProgress = 0;

    const updateProgress = (progress: number) => {
      currentProgress = Math.min(progress, 100);
      
      if (toastId === null) {
        // Create new toast
        toastId = toast.custom(
          () => (
            <UploadProgressToast
              fileName={fileName}
              progress={currentProgress}
              fileSize={fileSize}
            />
          ),
          {
            position: "bottom-right",
            duration: Infinity, // Don't auto-dismiss
          }
        );
      } else {
        // Update existing toast
        toast.custom(
          () => (
            <UploadProgressToast
              fileName={fileName}
              progress={currentProgress}
              fileSize={fileSize}
            />
          ),
          {
            position: "bottom-right",
            duration: Infinity,
            id: toastId,
          }
        );
      }
    };

    const complete = () => {
      if (toastId !== null) {
        toast.dismiss(toastId);
      }
      toastId = null;
    };

    return { updateProgress, complete };
  },
  
  app: (
    appId: string,
    owner: string,
    title: string,
    message: string,
    data?: Record<string, unknown>
  ) => {
    const detail = { appId, owner, title, message, data };
    window.dispatchEvent(
      new CustomEvent("aurora-app-notification", { detail })
    );
  },
};
