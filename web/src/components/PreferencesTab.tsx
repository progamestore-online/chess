import type { Settings, ThemePreference, FontSizePreference, MotionPreference, SurfacePreference, BoardTheme } from '../services/settings.ts'

interface PreferencesTabProps {
  settings: Settings
  updateSettings: (patch: Partial<Settings>) => void
}

export function PreferencesTab({ settings, updateSettings }: PreferencesTabProps) {
  return (
    <div className="space-y-6">
      <Section title="Appearance">
        <SegmentRow label="Theme" options={['system', 'light', 'dark'] as ThemePreference[]} value={settings.theme} onChange={(theme) => updateSettings({ theme })} />
        <SegmentRow label="Board" options={['classic', 'green', 'icy', 'dark', 'midnight'] as BoardTheme[]} labels={['Brown', 'Green', 'Ice', 'Dark', 'Night']} value={settings.boardTheme} onChange={(boardTheme) => updateSettings({ boardTheme })} />
        <SegmentRow label="Surface" options={['soft', 'bold'] as SurfacePreference[]} value={settings.surface} onChange={(surface) => updateSettings({ surface })} />
        <SegmentRow label="Motion" options={['full', 'reduced'] as MotionPreference[]} value={settings.motion} onChange={(motion) => updateSettings({ motion })} />
      </Section>

      <Section title="Size">
        <SegmentRow label="Labels" options={['small', 'medium', 'large', 'xlarge'] as FontSizePreference[]} labels={['S', 'M', 'L', 'XL']} value={settings.labelSize} onChange={(labelSize) => updateSettings({ labelSize })} />
        <SegmentRow label="Content" options={['small', 'medium', 'large', 'xlarge'] as FontSizePreference[]} labels={['S', 'M', 'L', 'XL']} value={settings.contentSize} onChange={(contentSize) => updateSettings({ contentSize })} />
      </Section>

      <Section title="Sound">
        <ToggleRow label="Audio narration" description="Speak moves and coaching aloud" value={settings.audio} onChange={(audio) => updateSettings({ audio, autoSpeak: audio })} />
        <ToggleRow label="Microphone input" description="Control the game with your voice" value={settings.microphone} onChange={(microphone) => updateSettings({ microphone })} />
        <ToggleRow label="Auto-speak coaching" description="Announce analysis after moves" value={settings.autoSpeak} onChange={(autoSpeak) => updateSettings({ autoSpeak })} />
      </Section>

      <Section title="Game">
        <ToggleRow label="Show coaching" description="Display analysis of your moves" value={settings.showCoaching} onChange={(showCoaching) => updateSettings({ showCoaching })} />
        <ToggleRow label="Evaluation bar" description="Show position evaluation on the board" value={settings.showEvalBar} onChange={(showEvalBar) => updateSettings({ showEvalBar })} />
      </Section>

      <div className="pt-4 text-center">
        <a href="https://progamestore.online" target="_blank" rel="noopener" className="text-[0.7rem] font-medium text-[var(--muted)] hover:text-[var(--ink)] transition-colors">
          Part of ProGameStore — free forever
        </a>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <h3 className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-[var(--muted)]">{title}</h3>
      <div className="space-y-2">
        {children}
      </div>
    </div>
  )
}

function SegmentRow<T extends string>({ label, options, labels, value, onChange }: {
  label: string
  options: T[]
  labels?: string[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm font-medium text-[var(--ink)]">{label}</span>
      <div className="flex gap-0.5 rounded-[0.75rem] border border-[var(--line)] bg-[var(--glass-soft)] p-0.5">
        {options.map((opt, i) => (
          <button
            key={opt}
            className={`rounded-[0.6rem] px-3 py-1.5 text-xs font-semibold capitalize ${
              value === opt
                ? 'bg-[var(--accent)] text-white shadow-sm'
                : 'text-[var(--muted)] hover:text-[var(--ink)]'
            }`}
            onClick={() => onChange(opt)}
          >
            {labels ? labels[i] : opt}
          </button>
        ))}
      </div>
    </div>
  )
}

function ToggleRow({ label, description, value, onChange }: {
  label: string
  description: string
  value: boolean
  onChange: (v: boolean) => void
}) {
  return (
    <button
      className="flex w-full items-center justify-between gap-4 rounded-[1rem] border border-[var(--line)] bg-[var(--glass-soft)] px-4 py-3 text-left"
      onClick={() => onChange(!value)}
    >
      <div>
        <div className="text-sm font-medium text-[var(--ink)]">{label}</div>
        <div className="text-xs text-[var(--muted)]">{description}</div>
      </div>
      <div className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${value ? 'bg-[var(--accent)]' : 'bg-[var(--line-strong)]'}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${value ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </div>
    </button>
  )
}
