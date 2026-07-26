import type { StatusMessage } from '../../hooks/useCandidates'

interface StatusBannerProps {
  statusMessage: StatusMessage
}

function StatusBanner({ statusMessage }: StatusBannerProps) {
  return (
    <p
      className={`status-alert lg:col-span-2 ${
        statusMessage.type === 'error'
          ? 'status-alert-error'
          : 'status-alert-success'
      }`}
    >
      {statusMessage.text}
    </p>
  )
}

export default StatusBanner
