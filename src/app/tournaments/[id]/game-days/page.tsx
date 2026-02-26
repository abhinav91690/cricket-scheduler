"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import {
  listGameDays, deleteGameDay,
  listTimeSlots, deleteTimeSlot,
  listGrounds,
} from "@/app/actions/ground-actions"
import { bulkCreateGameDays } from "@/app/actions/bulk-gameday-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type GameDay = { id: number; tournamentId: number; date: string }
type TimeSlot = { id: number; gameDayId: number; groundId: number; startTime: string; slotIndex: number }
type Ground = { id: number; name: string; format: string }

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]

export default function GameDaysPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [gameDayList, setGameDayList] = useState<GameDay[]>([])
  const [expandedDay, setExpandedDay] = useState<number | null>(null)
  const [slots, setSlots] = useState<TimeSlot[]>([])
  const [groundList, setGroundList] = useState<Ground[]>([])
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  // Bulk generator state
  const [startDate, setStartDate] = useState("")
  const [endDate, setEndDate] = useState("")
  const [selectedDays, setSelectedDays] = useState<number[]>([0, 6]) // Sun, Sat
  const [slotTimes, setSlotTimes] = useState<string[]>(["08:00", "12:00"])
  const [generating, setGenerating] = useState(false)

  function load() {
    listGameDays(tournamentId).then((r) => setGameDayList((r.data ?? []).sort((a, b) => a.date.localeCompare(b.date))))
    listGrounds(tournamentId).then((r) => setGroundList(r.data ?? []))
  }
  useEffect(load, [tournamentId])

  function loadSlots(gameDayId: number) {
    listTimeSlots(gameDayId).then((r) => setSlots(r.data ?? []))
  }

  function toggleDay(day: number) {
    setSelectedDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    )
  }

  function addSlotTime() {
    setSlotTimes(prev => [...prev, "16:00"])
  }

  function removeSlotTime(idx: number) {
    setSlotTimes(prev => prev.filter((_, i) => i !== idx))
  }

  function updateSlotTime(idx: number, value: string) {
    setSlotTimes(prev => prev.map((t, i) => i === idx ? value : t))
  }

  async function handleBulkGenerate() {
    setError(null)
    setMessage(null)
    setGenerating(true)
    const res = await bulkCreateGameDays({
      tournamentId,
      startDate,
      endDate,
      daysOfWeek: selectedDays,
      slotStartTimes: slotTimes,
    })
    if (res.error) {
      setError(res.error)
    } else if (res.data) {
      setMessage(`Created ${res.data.gameDays} game days with ${res.data.timeSlots} time slots across ${groundList.length} grounds.`)
      load()
    }
    setGenerating(false)
  }

  async function handleDeleteDay(id: number) {
    if (!confirm("Delete this game day and its time slots?")) return
    const res = await deleteGameDay(id)
    if (res.error) setError(res.error)
    else { load(); if (expandedDay === id) setExpandedDay(null) }
  }

  async function handleDeleteSlot(id: number) {
    const res = await deleteTimeSlot(id)
    if (res.error) setError(res.error)
    else loadSlots(expandedDay!)
  }

  function toggleExpand(id: number) {
    if (expandedDay === id) {
      setExpandedDay(null)
    } else {
      setExpandedDay(id)
      loadSlots(id)
    }
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-4xl mx-auto mt-6 space-y-6">
        {error && <p className="text-destructive text-sm">{error}</p>}
        {message && <p className="text-sm p-2 bg-green-50 dark:bg-green-950/20 rounded">{message}</p>}

        <Card>
          <CardHeader>
            <CardTitle>Bulk Generate Game Days</CardTitle>
            <CardDescription>
              Pick a date range, which days of the week to play, and how many games per day.
              Time slots will be auto-created for every ground on each game day.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <Label htmlFor="startDate">Start Date</Label>
                <Input id="startDate" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="endDate">End Date</Label>
                <Input id="endDate" type="date" value={endDate} onChange={e => setEndDate(e.target.value)} />
              </div>
            </div>

            <div className="space-y-1">
              <Label>Days of Week</Label>
              <div className="flex gap-2">
                {DAY_NAMES.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => toggleDay(idx)}
                    className={`px-3 py-1 rounded text-sm border transition-colors ${
                      selectedDays.includes(idx)
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background border-input hover:bg-accent"
                    }`}
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Games Per Day (slot start times)</Label>
                <Button size="sm" variant="secondary" onClick={addSlotTime}>Add Slot</Button>
              </div>
              <div className="flex gap-2 flex-wrap">
                {slotTimes.map((time, idx) => (
                  <div key={idx} className="flex items-center gap-1">
                    <span className="text-xs text-muted-foreground">Game {idx + 1}:</span>
                    <Input
                      type="time"
                      value={time}
                      onChange={e => updateSlotTime(idx, e.target.value)}
                      className="w-28"
                    />
                    {slotTimes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeSlotTime(idx)}
                        className="text-destructive text-sm hover:underline"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                {slotTimes.length} game(s) per day × {groundList.length} ground(s) = {slotTimes.length * groundList.length} slot(s) per game day
              </p>
            </div>

            <Button onClick={handleBulkGenerate} disabled={generating || !startDate || !endDate}>
              {generating ? "Generating..." : "Generate Game Days"}
            </Button>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-xl font-bold mb-4">Game Days ({gameDayList.length})</h2>
          <div className="space-y-2">
            {gameDayList.map((gd) => (
              <Card key={gd.id}>
                <CardContent className="pt-4">
                  <div className="flex items-center justify-between">
                    <button onClick={() => toggleExpand(gd.id)} className="text-left font-medium hover:underline">
                      {gd.date} ({DAY_NAMES[new Date(gd.date + "T00:00:00").getDay()]})
                    </button>
                    <Button size="sm" variant="destructive" onClick={() => handleDeleteDay(gd.id)}>Delete</Button>
                  </div>

                  {expandedDay === gd.id && (
                    <div className="mt-4 border-t pt-4">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Ground</TableHead>
                            <TableHead>Start Time</TableHead>
                            <TableHead>Slot</TableHead>
                            <TableHead className="text-right">Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {slots.map((s) => (
                            <TableRow key={s.id}>
                              <TableCell>
                                {groundList.find(g => g.id === s.groundId)?.name ?? s.groundId}
                                {" "}
                                <Badge variant="outline" className="text-xs">
                                  {groundList.find(g => g.id === s.groundId)?.format === "tape_ball" ? "TB" : "L"}
                                </Badge>
                              </TableCell>
                              <TableCell>{s.startTime}</TableCell>
                              <TableCell>{s.slotIndex}</TableCell>
                              <TableCell className="text-right">
                                <Button size="sm" variant="destructive" onClick={() => handleDeleteSlot(s.id)}>Delete</Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {slots.length === 0 && (
                            <TableRow><TableCell colSpan={4} className="text-muted-foreground text-center">No time slots</TableCell></TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
            {gameDayList.length === 0 && (
              <p className="text-muted-foreground text-center">No game days yet. Use the generator above.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
