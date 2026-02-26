"use client"

import { useState } from "react"
import { moveMatchAction, toggleLockAction, enterResultAction } from "@/app/actions/match-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"

type Match = {
  id: number; groupId: number | null; teamAId: number; teamBId: number
  timeSlotId: number | null; stage: string; status: string
  teamAScore: number | null; teamBScore: number | null; winnerId: number | null
  umpireTeam1Id: number | null; umpireTeam2Id: number | null
  isLocked: boolean; conflictOverride: string | null; knockoutRound: number | null
}
type Team = { id: number; groupId: number; name: string }
type TimeSlot = { id: number; gameDayId: number; groundId: number; startTime: string; slotIndex: number }
type Ground = { id: number; name: string; format: string }
type GameDay = { id: number; date: string }

interface Props {
  match: Match
  teamMap: Map<number, Team>
  slotMap: Map<number, TimeSlot>
  groundMap: Map<number, Ground>
  gameDayMap: Map<number, GameDay>
  onClose: () => void
  onUpdate: () => void
}

export function MatchDetailDialog({ match, teamMap, slotMap, groundMap, gameDayMap, onClose, onUpdate }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [showMove, setShowMove] = useState(false)
  const [showResult, setShowResult] = useState(false)

  const slot = match.timeSlotId ? slotMap.get(match.timeSlotId) : null
  const ground = slot ? groundMap.get(slot.groundId) : null
  const gameDay = slot ? gameDayMap.get(slot.gameDayId) : null
  const teamA = teamMap.get(match.teamAId)
  const teamB = teamMap.get(match.teamBId)
  const umpire1 = match.umpireTeam1Id ? teamMap.get(match.umpireTeam1Id) : null
  const umpire2 = match.umpireTeam2Id ? teamMap.get(match.umpireTeam2Id) : null

  async function handleToggleLock() {
    setError(null)
    const res = await toggleLockAction(match.id)
    if (res.error) setError(res.error)
    else { onUpdate(); onClose() }
  }

  async function handleMove(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const newSlotId = Number(fd.get("newSlotId"))
    const res = await moveMatchAction(match.id, newSlotId)
    if (res.error) {
      if (res.conflict) {
        if (confirm(`Conflict: ${res.error}. Override?`)) {
          const overrideRes = await moveMatchAction(match.id, newSlotId, true)
          if (overrideRes.error) { setError(overrideRes.error); return }
        } else return
      } else { setError(res.error); return }
    }
    onUpdate()
    onClose()
  }

  async function handleResult(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const teamAScore = Number(fd.get("teamAScore"))
    const teamBScore = Number(fd.get("teamBScore"))
    const winnerStr = fd.get("winnerId") as string
    const winnerId = winnerStr === "tie" ? null : Number(winnerStr)
    const res = await enterResultAction(match.id, teamAScore, teamBScore, winnerId)
    if (res.error) { setError(res.error); return }
    onUpdate()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={onClose} role="dialog" aria-modal="true" aria-label="Match details">
      <div className="bg-background rounded-lg p-6 max-w-md w-full mx-4 space-y-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold">Match #{match.id}</h3>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground" aria-label="Close dialog">✕</button>
        </div>

        {error && <p className="text-destructive text-sm">{error}</p>}

        <div className="space-y-2 text-sm">
          <p><span className="text-muted-foreground">Teams:</span> {teamA?.name ?? match.teamAId} vs {teamB?.name ?? match.teamBId}</p>
          <p><span className="text-muted-foreground">Stage:</span> {match.stage}{match.knockoutRound ? ` (Round ${match.knockoutRound})` : ""}</p>
          <p><span className="text-muted-foreground">Date:</span> {gameDay?.date ?? "Unscheduled"}</p>
          <p><span className="text-muted-foreground">Time:</span> {slot?.startTime ?? "—"}</p>
          <p><span className="text-muted-foreground">Ground:</span> {ground?.name ?? "—"}</p>
          <p><span className="text-muted-foreground">Umpire 1:</span> {umpire1?.name ?? "—"}</p>
          {umpire2 && <p><span className="text-muted-foreground">Umpire 2:</span> {umpire2.name}</p>}
          <p><span className="text-muted-foreground">Status:</span> <Badge variant={match.status === "played" ? "default" : "outline"}>{match.status}</Badge></p>
          {match.status === "played" && (
            <p><span className="text-muted-foreground">Score:</span> {match.teamAScore} - {match.teamBScore}</p>
          )}
          <p><span className="text-muted-foreground">Locked:</span> {match.isLocked ? "Yes" : "No"}</p>
          {match.conflictOverride && <p><span className="text-muted-foreground">Override:</span> {match.conflictOverride}</p>}
        </div>

        {match.status !== "played" && (
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="secondary" onClick={handleToggleLock}>
              {match.isLocked ? "Unlock" : "Lock"}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => setShowMove(!showMove)}>Move</Button>
            <Button size="sm" onClick={() => setShowResult(!showResult)}>Enter Result</Button>
          </div>
        )}

        {showMove && (
          <form onSubmit={handleMove} className="flex gap-2 items-end">
            <div className="space-y-1 flex-1">
              <Label htmlFor="newSlotId">New Slot ID</Label>
              <Input id="newSlotId" name="newSlotId" type="number" required />
            </div>
            <Button type="submit" size="sm">Move</Button>
          </form>
        )}

        {showResult && (
          <form onSubmit={handleResult} className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="teamAScore">{teamA?.name ?? "Team A"} Score</Label>
                <Input id="teamAScore" name="teamAScore" type="number" required min={0} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="teamBScore">{teamB?.name ?? "Team B"} Score</Label>
                <Input id="teamBScore" name="teamBScore" type="number" required min={0} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="winnerId">Winner</Label>
              <select id="winnerId" name="winnerId" className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value={match.teamAId}>{teamA?.name ?? "Team A"}</option>
                <option value={match.teamBId}>{teamB?.name ?? "Team B"}</option>
                <option value="tie">Tie</option>
              </select>
            </div>
            <Button type="submit" size="sm">Save Result</Button>
          </form>
        )}
      </div>
    </div>
  )
}
