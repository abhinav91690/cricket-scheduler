"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listTeams, createTeam, updateTeam, deleteTeam } from "@/app/actions/team-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Team = { id: number; groupId: number; name: string }

export default function TeamsPage() {
  const params = useParams()
  const tournamentId = String(params.id)
  const groupId = Number(params.groupId)
  const [teamList, setTeamList] = useState<Team[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    listTeams(groupId).then((r) => setTeamList(r.data ?? []))
  }
  useEffect(load, [groupId])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await createTeam({ groupId, name: fd.get("name") as string })
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    load()
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateTeam(editId!, { name: fd.get("name") as string })
    if (res.error) { setError(res.error); return }
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    setError(null)
    const res = await deleteTeam(id)
    if (res.error) {
      const matchInfo = res.matches ? ` (${res.matches.length} matches affected)` : ""
      setError(res.error + matchInfo)
      return
    }
    load()
  }

  return (
    <div>
      <TournamentNav tournamentId={tournamentId} />
      <div className="max-w-4xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Teams</h2>
          <Button onClick={() => { setShowForm(true); setEditId(null) }}>Add Team</Button>
        </div>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {(showForm || editId !== null) && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form onSubmit={editId !== null ? handleUpdate : handleCreate} className="flex gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Team Name</Label>
                  <Input id="name" name="name" required defaultValue={editId !== null ? teamList.find(t => t.id === editId)?.name : ""} />
                </div>
                <Button type="submit">{editId !== null ? "Save" : "Create"}</Button>
                <Button type="button" variant="secondary" onClick={() => { setShowForm(false); setEditId(null) }}>Cancel</Button>
              </form>
            </CardContent>
          </Card>
        )}

        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {teamList.map((t) => (
              <TableRow key={t.id}>
                <TableCell>{t.name}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditId(t.id)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(t.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {teamList.length === 0 && (
              <TableRow><TableCell colSpan={2} className="text-muted-foreground text-center">No teams yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
