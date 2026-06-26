export interface ArchiveConfirmState {
  title: string;
  body: string;
  onConfirm: () => void;
}

export interface ArchiveConfirmModalProps {
  state: ArchiveConfirmState | null;
  onCancel: () => void;
}

export function ArchiveConfirmModal({ state, onCancel }: ArchiveConfirmModalProps) {
  if (!state) return null;
  return (
    <div
      className="archive-confirm-overlay visible"
      id="archiveConfirmModal"
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="archive-confirm-card">
        <div className="archive-confirm-title" id="archiveConfirmTitle">
          {state.title}
        </div>
        <div className="archive-confirm-body" id="archiveConfirmBody">
          {state.body}
        </div>
        <div className="archive-confirm-actions">
          <button className="btn-ghost" id="archiveConfirmCancelBtn" onClick={onCancel}>
            Cancel
          </button>
          <button
            className="btn-danger"
            id="archiveConfirmDeleteBtn"
            onClick={() => {
              state.onConfirm();
              onCancel();
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
