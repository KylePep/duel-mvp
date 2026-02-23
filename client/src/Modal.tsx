import { useEffect } from "react";
import './Modal.css';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  autoCloseMs?: number;
  children: React.ReactNode;
};

export default function Modal({
  open,
  onClose,
  autoCloseMs = 3000,
  children,
}: ModalProps) {
  useEffect(() => {
    if (!open) return;

    const timer = setTimeout(onClose, autoCloseMs);
    return () => clearTimeout(timer);
  }, [open, autoCloseMs, onClose]);

  if (!open) return null;

  return (
    <div
      className="modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}
