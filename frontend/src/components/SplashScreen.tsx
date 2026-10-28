import { useEffect, useState } from 'react'

/** مدة بقاء شاشة الترحيب ظاهرة (٣ ثوانٍ)، ثم مدة التلاشي التدريجي. */
const HOLD_MS = 3000
const FADE_MS = 400
const SRC = `${import.meta.env.BASE_URL}splash.jpg`

/**
 * شاشة ترحيب تظهر عند فتح تطبيق الهاتف (النسخة المستقلة على GitHub Pages)،
 * ثم تتلاشى تلقائيًا لتُظهر شاشة الدخول أو الصفحة الرئيسية.
 * الصورة تُعرض كاملة دون قصّ، وخلفيتها نسخة مموّهة منها لتملأ الشاشة.
 */
export default function SplashScreen() {
  const [leaving, setLeaving] = useState(false)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const t1 = window.setTimeout(() => setLeaving(true), HOLD_MS)
    const t2 = window.setTimeout(() => {
      setHidden(true)
      document.body.style.overflow = previousOverflow
    }, HOLD_MS + FADE_MS)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      document.body.style.overflow = previousOverflow
    }
  }, [])

  if (hidden) return null

  return (
    <div
      aria-hidden="true"
      className={`fixed inset-0 z-[9999] overflow-hidden bg-[#0b2a5c] transition-opacity duration-500 ${
        leaving ? 'pointer-events-none opacity-0' : 'opacity-100'
      }`}
    >
      {/* خلفية مموّهة من نفس الصورة لتغطية الشاشة بالكامل */}
      <img src={SRC} alt="" className="absolute inset-0 h-full w-full scale-110 object-cover blur-2xl" draggable={false} />
      {/* الصورة كاملة دون أي قصّ */}
      <img
        src={SRC}
        alt=""
        className="relative h-full w-full select-none object-contain"
        draggable={false}
        onError={() => setHidden(true)}
      />
    </div>
  )
}
