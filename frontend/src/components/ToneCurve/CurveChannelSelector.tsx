import { CurveChannel } from '../../editor'

const CHANNELS: Array<{ key: CurveChannel; label: string; title: string }> = [
  { key: 'rgb', label: 'RGB', title: 'Curva tonale complessiva' },
  { key: 'red', label: 'R', title: 'Curva canale rosso' },
  { key: 'green', label: 'G', title: 'Curva canale verde' },
  { key: 'blue', label: 'B', title: 'Curva canale blu' },
]

type CurveChannelSelectorProps = {
  active: CurveChannel
  disabled: boolean
  onChange: (channel: CurveChannel) => void
}

function CurveChannelSelector({ active, disabled, onChange }: CurveChannelSelectorProps) {
  return (
    <div className="curve-channel-selector" role="group" aria-label="Canale curva">
      {CHANNELS.map((channel) => (
        <button
          type="button"
          key={channel.key}
          className={`curve-channel ${channel.key}${active === channel.key ? ' active' : ''}`}
          aria-pressed={active === channel.key}
          title={channel.title}
          disabled={disabled}
          onClick={() => onChange(channel.key)}
        >
          {channel.label}
        </button>
      ))}
    </div>
  )
}

export default CurveChannelSelector

