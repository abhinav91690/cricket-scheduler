"use server"

import { db } from "@/lib/db/connection"
import { gameDays, timeSlots, grounds } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

export interface BulkGameDayInput {
  tournamentId: number
  startDate: string // YYYY-MM-DD
  endDate: string   // YYYY-MM-DD
  daysOfWeek: number[] // 0=Sun, 1=Mon, ..., 6=Sat
  slotStartTimes: string[] // e.g. ["08:00", "12:00"] for 2 games/day, or ["08:00", "12:00", "16:00"] for 3
}

export async function bulkCreateGameDays(input: BulkGameDayInput) {
  const { tournamentId, startDate, endDate, daysOfWeek, slotStartTimes } = input

  if (!startDate || !endDate) return { error: "Start and end dates are required" }
  if (daysOfWeek.length === 0) return { error: "Select at least one day of the week" }
  if (slotStartTimes.length === 0) return { error: "Add at least one slot start time" }

  const start = new Date(startDate + "T00:00:00")
  const end = new Date(endDate + "T00:00:00")
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return { error: "Invalid date format" }
  if (start > end) return { error: "Start date must be before end date" }

  // Get all grounds for this tournament
  const groundList = await db.select().from(grounds).where(eq(grounds.tournamentId, tournamentId))
  if (groundList.length === 0) return { error: "No grounds defined. Add grounds first." }

  // Generate dates matching the day-of-week pattern
  const dates: string[] = []
  const current = new Date(start)
  while (current <= end) {
    if (daysOfWeek.includes(current.getDay())) {
      const yyyy = current.getFullYear()
      const mm = String(current.getMonth() + 1).padStart(2, "0")
      const dd = String(current.getDate()).padStart(2, "0")
      dates.push(`${yyyy}-${mm}-${dd}`)
    }
    current.setDate(current.getDate() + 1)
  }

  if (dates.length === 0) return { error: "No dates match the selected days of the week in the given range" }

  let gameDayCount = 0
  let slotCount = 0

  for (const date of dates) {
    const [gd] = await db.insert(gameDays).values({
      tournamentId,
      date,
    }).returning()
    gameDayCount++

    // Create time slots for every ground × every start time
    for (const ground of groundList) {
      for (let i = 0; i < slotStartTimes.length; i++) {
        await db.insert(timeSlots).values({
          gameDayId: gd.id,
          groundId: ground.id,
          startTime: slotStartTimes[i],
          slotIndex: i,
        })
        slotCount++
      }
    }
  }

  return {
    data: {
      gameDays: gameDayCount,
      timeSlots: slotCount,
      dates,
    },
  }
}
