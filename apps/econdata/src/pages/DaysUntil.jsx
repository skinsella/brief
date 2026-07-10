import { motion } from 'framer-motion'
import { CountdownCard } from '@/components/CountdownCard'
import { upcomingEvents } from '@/lib/constants'

export default function DaysUntil() {
  const events = upcomingEvents()

  return (
    <motion.div
      className="p-8 space-y-8 overflow-y-auto h-full"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div>
        <h1 className="text-3xl font-bold text-slate-900">Days Until...</h1>
        <p className="text-slate-500 mt-1">Upcoming economic events and releases · {events.length} events</p>
      </div>

      {events.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No upcoming events in the calendar. Extend <code className="bg-slate-100 px-1 rounded">COUNTDOWN_EVENTS</code> in <code className="bg-slate-100 px-1 rounded">src/lib/constants.js</code>.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event) => (
            <CountdownCard
              key={`${event.title}-${event.targetDate}`}
              title={event.title}
              targetDate={event.targetDate}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
