import { Modal } from './Modal';

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  danger?: boolean;
}

export function ConfirmDialog({ open, onClose, onConfirm, title, message, confirmLabel = 'تأكيد', danger }: ConfirmDialogProps) {
  return (
    <Modal open={open} onClose={onClose} title={title} size="sm">
      <p className="text-neutral-600 leading-relaxed">{message}</p>
      <div className="flex gap-3 mt-6">
        <button onClick={onClose} className="btn-secondary flex-1">إلغاء</button>
        <button
          onClick={() => { onConfirm(); onClose(); }}
          className={`flex-1 ${danger ? 'btn-danger' : 'btn-primary'}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}
