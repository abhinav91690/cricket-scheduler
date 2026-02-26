"use server"

import { db } from "@/lib/db/connection"
import { grounds, gameDays, timeSlots } from "@/lib/db/schema"
import { eq } from "drizzle-orm"

// --- Ground CRUD ---

export async function createGround(data: {
  tournamentId: number
  name: string
  format: "leather" | "tape_ball"
}) {
  if (!data.name || !data.name.trim()) {
    return { error: "Name is required" }
  }

  if (data.format !== "leather" && data.format !== "tape_ball") {
    return { error: 'Format must be "leather" or "tape_ball"' }
  }

  const [result] = await db
    .insert(grounds)
    .values({
      tournamentId: data.tournamentId,
      name: data.name.trim(),
      format: data.format,
    })
    .returning()

  return { data: result }
}

export async function updateGround(
  id: number,
  data: Partial<{ name: string; format: "leather" | "tape_ball" }>
) {
  if (data.name !== undefined && !data.name.trim()) {
    return { error: "Name cannot be empty" }
  }

  if (
    data.format !== undefined &&
    data.format !== "leather" &&
    data.format !== "tape_ball"
  ) {
    return { error: 'Format must be "leather" or "tape_ball"' }
  }

  const updateData: Record<string, unknown> = {}
  if (data.name !== undefined) updateData.name = data.name.trim()
  if (data.format !== undefined) updateData.format = data.format

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(grounds)
    .set(updateData)
    .where(eq(grounds.id, id))
    .returning()

  if (!result) {
    return { error: "Ground not found" }
  }

  return { data: result }
}

export async function deleteGround(id: number) {
  const [ground] = await db
    .select()
    .from(grounds)
    .where(eq(grounds.id, id))

  if (!ground) {
    return { error: "Ground not found" }
  }

  await db.delete(grounds).where(eq(grounds.id, id))

  return { data: { id } }
}

export async function listGrounds(tournamentId: number) {
  const result = await db
    .select()
    .from(grounds)
    .where(eq(grounds.tournamentId, tournamentId))

  return { data: result }
}

// --- GameDay CRUD ---

export async function createGameDay(data: {
  tournamentId: number
  date: string
}) {
  if (!data.date || !data.date.trim()) {
    return { error: "Date is required" }
  }

  const dateRegex = /^\d{4}-\d{2}-\d{2}$/
  if (!dateRegex.test(data.date.trim())) {
    return { error: "Date must be in YYYY-MM-DD format" }
  }

  const [result] = await db
    .insert(gameDays)
    .values({
      tournamentId: data.tournamentId,
      date: data.date.trim(),
    })
    .returning()

  return { data: result }
}

export async function updateGameDay(
  id: number,
  data: Partial<{ date: string }>
) {
  if (data.date !== undefined) {
    if (!data.date.trim()) {
      return { error: "Date cannot be empty" }
    }
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/
    if (!dateRegex.test(data.date.trim())) {
      return { error: "Date must be in YYYY-MM-DD format" }
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.date !== undefined) updateData.date = data.date.trim()

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(gameDays)
    .set(updateData)
    .where(eq(gameDays.id, id))
    .returning()

  if (!result) {
    return { error: "Game day not found" }
  }

  return { data: result }
}

export async function deleteGameDay(id: number) {
  const [gameDay] = await db
    .select()
    .from(gameDays)
    .where(eq(gameDays.id, id))

  if (!gameDay) {
    return { error: "Game day not found" }
  }

  // Cascade delete time slots for this game day
  await db.delete(timeSlots).where(eq(timeSlots.gameDayId, id))

  await db.delete(gameDays).where(eq(gameDays.id, id))

  return { data: { id } }
}

export async function listGameDays(tournamentId: number) {
  const result = await db
    .select()
    .from(gameDays)
    .where(eq(gameDays.tournamentId, tournamentId))

  return { data: result }
}

// --- TimeSlot CRUD ---

export async function createTimeSlot(data: {
  gameDayId: number
  groundId: number
  startTime: string
  slotIndex: number
}) {
  if (data.slotIndex < 0 || data.slotIndex > 2) {
    return { error: "Slot index must be 0, 1, or 2" }
  }

  if (!data.startTime || !data.startTime.trim()) {
    return { error: "Start time is required" }
  }

  const timeRegex = /^\d{2}:\d{2}$/
  if (!timeRegex.test(data.startTime.trim())) {
    return { error: "Start time must be in HH:MM format" }
  }

  const [result] = await db
    .insert(timeSlots)
    .values({
      gameDayId: data.gameDayId,
      groundId: data.groundId,
      startTime: data.startTime.trim(),
      slotIndex: data.slotIndex,
    })
    .returning()

  return { data: result }
}

export async function updateTimeSlot(
  id: number,
  data: Partial<{ groundId: number; startTime: string; slotIndex: number }>
) {
  if (data.slotIndex !== undefined && (data.slotIndex < 0 || data.slotIndex > 2)) {
    return { error: "Slot index must be 0, 1, or 2" }
  }

  if (data.startTime !== undefined) {
    if (!data.startTime.trim()) {
      return { error: "Start time cannot be empty" }
    }
    const timeRegex = /^\d{2}:\d{2}$/
    if (!timeRegex.test(data.startTime.trim())) {
      return { error: "Start time must be in HH:MM format" }
    }
  }

  const updateData: Record<string, unknown> = {}
  if (data.groundId !== undefined) updateData.groundId = data.groundId
  if (data.startTime !== undefined) updateData.startTime = data.startTime.trim()
  if (data.slotIndex !== undefined) updateData.slotIndex = data.slotIndex

  if (Object.keys(updateData).length === 0) {
    return { error: "No fields to update" }
  }

  const [result] = await db
    .update(timeSlots)
    .set(updateData)
    .where(eq(timeSlots.id, id))
    .returning()

  if (!result) {
    return { error: "Time slot not found" }
  }

  return { data: result }
}

export async function deleteTimeSlot(id: number) {
  const [slot] = await db
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.id, id))

  if (!slot) {
    return { error: "Time slot not found" }
  }

  await db.delete(timeSlots).where(eq(timeSlots.id, id))

  return { data: { id } }
}

export async function listTimeSlots(gameDayId: number) {
  const result = await db
    .select()
    .from(timeSlots)
    .where(eq(timeSlots.gameDayId, gameDayId))

  return { data: result }
}
