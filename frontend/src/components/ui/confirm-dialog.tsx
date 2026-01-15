import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description: string
  confirmText?: string
  cancelText?: string
  variant?: "default" | "destructive"
  onConfirm: () => void
  onCancel?: () => void
}

/**
 * Reusable confirmation dialog component.
 *
 * Usage:
 * ```tsx
 * const [showConfirm, setShowConfirm] = useState(false)
 * const [pendingDelete, setPendingDelete] = useState<string | null>(null)
 *
 * const handleDelete = (id: string) => {
 *   setPendingDelete(id)
 *   setShowConfirm(true)
 * }
 *
 * const confirmDelete = () => {
 *   if (pendingDelete) {
 *     // perform delete
 *   }
 * }
 *
 * <ConfirmDialog
 *   open={showConfirm}
 *   onOpenChange={setShowConfirm}
 *   title="Delete Server"
 *   description="Are you sure you want to delete this server?"
 *   variant="destructive"
 *   onConfirm={confirmDelete}
 * />
 * ```
 */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmText = "Confirm",
  cancelText = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const handleConfirm = () => {
    // Execute action first, then close dialog
    // This ensures state is still available during the action
    onConfirm()
    onOpenChange(false)
  }

  const handleCancel = () => {
    onCancel?.()
    onOpenChange(false)
  }

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>
            {cancelText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            className={cn(
              variant === "destructive" &&
                buttonVariants({ variant: "destructive" })
            )}
          >
            {confirmText}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
