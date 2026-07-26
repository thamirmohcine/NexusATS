import { useTranslation } from 'react-i18next'

import { CloseIcon } from '../ui/icons'

interface PdfPreviewModalProps {
  onClose: () => void
  pdfUrl: string
}

function PdfPreviewModal({ onClose, pdfUrl }: PdfPreviewModalProps) {
  const { t } = useTranslation()

  return (
    <div
      aria-labelledby="pdf-preview-title"
      aria-modal="true"
      className="modal-backdrop"
      onMouseDown={onClose}
      role="dialog"
    >
      <div
        className="modal-content max-h-[92vh] max-w-5xl"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="card-header flex items-center justify-between gap-4 px-5 py-4">
          <div className="min-w-0">
            <h2
              className="section-title truncate text-lg"
              id="pdf-preview-title"
            >
              {t('pdfPreview.title')}
            </h2>
            <a
              className="text-link mt-1 inline-flex"
              href={pdfUrl}
              rel="noreferrer"
              target="_blank"
            >
              {t('pdfPreview.openNewTab')}
            </a>
          </div>
          <button
            aria-label={t('pdfPreview.close')}
            className="btn-icon"
            onClick={onClose}
            title={t('pdfPreview.close')}
            type="button"
          >
            <CloseIcon />
          </button>
        </div>
        <iframe
          className="h-[600px] w-full"
          src={pdfUrl}
          title={t('pdfPreview.iframeTitle')}
        />
      </div>
    </div>
  )
}

export default PdfPreviewModal
