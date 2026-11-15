// Birthday surprise. Uses the device's own clock and time zone, so it appears on
// 16 November wherever Azka is (Cleveland included), not on the server's date.
// Change the date or message here.
import { useEffect, useState } from 'react'
import { useApp } from '../../state/AppContext'
import { catSvgInner, type Stage } from '../../components/catArt'

export const BIRTHDAY = { month: 11, day: 16 }
const FROM = 'Roshan'

export function isBirthday(d = new Date()) {
  return d.getMonth() + 1 === BIRTHDAY.month && d.getDate() === BIRTHDAY.day
}

const COLORS = ['#B23A68', '#F4C3BE', '#5B3F96', '#E9A465', '#2C6B52', '#FCE4EE']

export default function BirthdaySplash() {
  const { profile, catName, growth, today } = useApp()
  const key = `birthday-seen-${today}`
  const [open, setOpen] = useState(false)
  useEffect(() => {
    if (!isBirthday()) return
    try { if (!localStorage.getItem(key)) setOpen(true) } catch { setOpen(true) }
  }, [key])
  if (!open) return null
  const close = () => { try { localStorage.setItem(key, '1') } catch { /* private mode */ } setOpen(false) }
  const name = profile?.display_name || 'Azka'

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="bday-title" className="fixed inset-0 z-[60] flex items-center justify-center overflow-hidden bg-rose-soft px-6">
      <div aria-hidden className="pointer-events-none absolute inset-0">
        {Array.from({ length: 36 }, (_, i) => (
          <span key={i} className="confetti absolute top-[-20px] block h-3 w-2 rounded-sm"
            style={{ left: `${(i * 37) % 100}%`, background: COLORS[i % COLORS.length], animationDelay: `${(i % 9) * 0.25}s`, animationDuration: `${3 + (i % 5) * 0.6}s` }} />
        ))}
      </div>
      <div className="relative flex max-w-md flex-col items-center gap-4 text-center">
        <svg role="img" aria-label={`${catName} celebrating`} width="190" height="190" viewBox="0 0 120 120" className="mochi-react" style={{ overflow: 'visible' }}
          dangerouslySetInnerHTML={{ __html: catSvgInner('celebrate', growth.stage.key as Stage) }} />
        <h1 id="bday-title" className="h1 text-[34px] text-rose-dark">Happy birthday, {name}!</h1>
        <p className="m-0 text-lg">{catName} has a message for you from {FROM}:</p>
        <p className="m-0 rounded-2xl rounded-bl-sm border border-line bg-surface px-5 py-4 text-xl font-semibold leading-snug">
          {FROM} loves you the most <span aria-label="heart">❤️</span>
        </p>
        <p className="m-0 text-muted">Take it easy today. Every minute you study counts double, and resting counts too.</p>
        <button type="button" className="btn-primary min-h-14 px-8 text-[17px]" onClick={close} autoFocus>Thank you, {catName.replace(/^Dr\. /, '')}!</button>
      </div>
    </div>
  )
}

/** Small reminder on Today for the rest of the day, after the splash is closed. */
export function BirthdayBanner() {
  if (!isBirthday()) return null
  return <p className="m-0 rounded-2xl bg-rose-soft px-4 py-3 text-center font-semibold text-rose-dark">Happy birthday! {FROM} loves you the most ❤️</p>
}
