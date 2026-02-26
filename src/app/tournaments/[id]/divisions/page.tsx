"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { listDivisions, createDivision, updateDivision, deleteDivision } from "@/app/actions/division-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Division = { id: number; tournamentId: number; tier: number; name: string }

export default function DivisionsPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [divisions, setDivisions] = useState<Division[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    listDivisions(tournamentId).then((r) => setDivisions(r.data ?? []))
  }
  useEffect(load, [tournamentId])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await createDivision({
      tournamentId,
      tier: Number(fd.get("tier")),
      name: fd.get("name") as string,
    })
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    load()
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateDivision(editId!, {
      tier: Number(fd.get("tier")),
      name: fd.get("name") as string,
    })
    if (res.error) { setError(res.error); return }
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this division and all its groups/teams?")) return
    const res = await deleteDivision(id)
    if (res.error) setError(res.error)
    else load()
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-4xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Divisions</h2>
          <Button onClick={() => { setShowForm(true); setEditId(null) }}>Add Division</Button>
        </div>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {(showForm || editId !== null) && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form onSubmit={editId !== null ? handleUpdate : handleCreate} className="flex gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required defaultValue={editId !== null ? divisions.find(d => d.id === editId)?.name : ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="tier">Tier (1-4)</Label>
                  <Input id="tier" name="tier" type="number" min={1} max={4} required defaultValue={editId !== null ? divisions.find(d => d.id === editId)?.tier : 1} />
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
              <TableHead>Tier</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {divisions.map((d) => (
              <TableRow key={d.id}>
                <TableCell>
                  <Link href={`/tournaments/${tournamentId}/divisions/${d.id}/groups`} className="text-primary hover:underline">
                    {d.name}
                  </Link>
                </TableCell>
                <TableCell>{d.tier}</TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditId(d.id)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(d.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {divisions.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">No divisions yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
