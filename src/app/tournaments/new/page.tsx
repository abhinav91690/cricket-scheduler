"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createTournament } from "@/app/actions/tournament-actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"

export default function NewTournamentPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const result = await createTournament({
      name: fd.get("name") as string,
      season: fd.get("season") as string,
      leatherGameDurationMin: Number(fd.get("leatherGameDurationMin")) || 240,
      tapeBallGameDurationMin: Number(fd.get("tapeBallGameDurationMin")) || 225,
      leatherQualifierCount: Number(fd.get("leatherQualifierCount")) || 8,
      tapeBallQualifierCount: Number(fd.get("tapeBallQualifierCount")) || 6,
    })
    if (result.error) {
      setError(result.error)
    } else {
      router.push(`/tournaments/${result.data!.id}`)
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <Card>
        <CardHeader>
          <CardTitle>Create Tournament</CardTitle>
        </CardHeader>
        <CardContent>
          {error && <p className="text-destructive text-sm mb-4">{error}</p>}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" name="name" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="season">Season</Label>
              <Input id="season" name="season" required placeholder="e.g. 2026" />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leatherGameDurationMin">Leather Game Duration (min)</Label>
                <Input id="leatherGameDurationMin" name="leatherGameDurationMin" type="number" defaultValue={240} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tapeBallGameDurationMin">Tape Ball Game Duration (min)</Label>
                <Input id="tapeBallGameDurationMin" name="tapeBallGameDurationMin" type="number" defaultValue={225} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="leatherQualifierCount">Leather Qualifier Count</Label>
                <Input id="leatherQualifierCount" name="leatherQualifierCount" type="number" defaultValue={8} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="tapeBallQualifierCount">Tape Ball Qualifier Count</Label>
                <Input id="tapeBallQualifierCount" name="tapeBallQualifierCount" type="number" defaultValue={6} />
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">Create</Button>
              <Button type="button" variant="secondary" onClick={() => router.push("/")}>Cancel</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
