"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { getTournament, updateTournament, deleteTournament } from "@/app/actions/tournament-actions"
import { listDivisions } from "@/app/actions/division-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"

type Tournament = {
  id: number
  name: string
  season: string
  leatherGameDurationMin: number
  tapeBallGameDurationMin: number
  leatherQualifierCount: number
  tapeBallQualifierCount: number
}

export default function TournamentDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = Number(params.id)
  const [tournament, setTournament] = useState<Tournament | null>(null)
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [divisionCount, setDivisionCount] = useState(0)

  useEffect(() => {
    getTournament(id).then((res) => {
      if (res.data) setTournament(res.data)
    })
    listDivisions(id).then((res) => {
      setDivisionCount(res.data?.length ?? 0)
    })
  }, [id])

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await updateTournament(id, {
      name: fd.get("name") as string,
      season: fd.get("season") as string,
      leatherGameDurationMin: Number(fd.get("leatherGameDurationMin")),
      tapeBallGameDurationMin: Number(fd.get("tapeBallGameDurationMin")),
      leatherQualifierCount: Number(fd.get("leatherQualifierCount")),
      tapeBallQualifierCount: Number(fd.get("tapeBallQualifierCount")),
    })
    if (result.error) {
      setError(result.error)
    } else {
      setTournament(result.data!)
      setEditing(false)
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this tournament and all its data?")) return
    const result = await deleteTournament(id)
    if (result.error) {
      setError(result.error)
    } else {
      router.push("/")
    }
  }

  if (!tournament) return <p className="p-6">Loading...</p>

  return (
    <div>
      <TournamentNav tournamentId={String(id)} />
      <div className="max-w-2xl mx-auto mt-6">
        <Card>
          <CardHeader>
            <CardTitle>{editing ? "Edit Tournament" : tournament.name}</CardTitle>
          </CardHeader>
          <CardContent>
            {error && <p className="text-destructive text-sm mb-4">{error}</p>}
            {editing ? (
              <form onSubmit={handleUpdate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" defaultValue={tournament.name} required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="season">Season</Label>
                  <Input id="season" name="season" defaultValue={tournament.season} required />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leatherGameDurationMin">Leather Duration (min)</Label>
                    <Input id="leatherGameDurationMin" name="leatherGameDurationMin" type="number" defaultValue={tournament.leatherGameDurationMin} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tapeBallGameDurationMin">Tape Ball Duration (min)</Label>
                    <Input id="tapeBallGameDurationMin" name="tapeBallGameDurationMin" type="number" defaultValue={tournament.tapeBallGameDurationMin} />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="leatherQualifierCount">Leather Qualifiers</Label>
                    <Input id="leatherQualifierCount" name="leatherQualifierCount" type="number" defaultValue={tournament.leatherQualifierCount} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tapeBallQualifierCount">Tape Ball Qualifiers</Label>
                    <Input id="tapeBallQualifierCount" name="tapeBallQualifierCount" type="number" defaultValue={tournament.tapeBallQualifierCount} />
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button type="submit">Save</Button>
                  <Button type="button" variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <p><span className="text-muted-foreground">Season:</span> {tournament.season}</p>
                <p><span className="text-muted-foreground">Leather Duration:</span> {tournament.leatherGameDurationMin} min</p>
                <p><span className="text-muted-foreground">Tape Ball Duration:</span> {tournament.tapeBallGameDurationMin} min</p>
                <p><span className="text-muted-foreground">Leather Qualifiers:</span> {tournament.leatherQualifierCount}</p>
                <p><span className="text-muted-foreground">Tape Ball Qualifiers:</span> {tournament.tapeBallQualifierCount}</p>
                <div className="flex gap-2 pt-4">
                  <Button onClick={() => setEditing(true)}>Edit</Button>
                  <Button variant="destructive" onClick={handleDelete}>Delete</Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <h3 className="text-lg font-semibold mt-8 mb-4">Setup Guide</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/tournaments/${id}/divisions`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">1. Divisions & Groups</CardTitle>
                <CardDescription>
                  Create divisions (tiers 1–4), then add groups within each division with a format (leather or tape ball).
                  {divisionCount > 0 ? ` (${divisionCount} divisions created)` : ""}
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href={`/tournaments/${id}/divisions`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">2. Teams</CardTitle>
                <CardDescription>
                  Navigate into a group to register teams. Go to Divisions → click a division → click a group → add teams.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href={`/tournaments/${id}/conflicts`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">3. Team Conflicts</CardTitle>
                <CardDescription>
                  Define conflicts between teams that share players across formats (same slot or same day).
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href={`/tournaments/${id}/grounds`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">4. Grounds & Game Days</CardTitle>
                <CardDescription>
                  Add grounds with format assignments, then create game days and time slots.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
          <Link href={`/tournaments/${id}/schedule`}>
            <Card className="hover:bg-accent/50 transition-colors cursor-pointer h-full">
              <CardHeader>
                <CardTitle className="text-base">5. Generate Schedule</CardTitle>
                <CardDescription>
                  Once teams, grounds, and game days are set up, generate the match schedule.
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  )
}
