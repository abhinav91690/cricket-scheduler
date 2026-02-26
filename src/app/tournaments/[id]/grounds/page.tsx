"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import { listGrounds, createGround, updateGround, deleteGround } from "@/app/actions/ground-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

type Ground = { id: number; tournamentId: number; name: string; format: string }

export default function GroundsPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [groundList, setGroundList] = useState<Ground[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    listGrounds(tournamentId).then((r) => setGroundList(r.data ?? []))
  }
  useEffect(load, [tournamentId])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await createGround({
      tournamentId,
      name: fd.get("name") as string,
      format: fd.get("format") as "leather" | "tape_ball",
    })
    if (res.error) { setError(res.error); return }
    setShowForm(false)
    load()
  }

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await updateGround(editId!, {
      name: fd.get("name") as string,
      format: fd.get("format") as "leather" | "tape_ball",
    })
    if (res.error) { setError(res.error); return }
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this ground?")) return
    const res = await deleteGround(id)
    if (res.error) setError(res.error)
    else load()
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-4xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Grounds</h2>
          <Button onClick={() => { setShowForm(true); setEditId(null) }}>Add Ground</Button>
        </div>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {(showForm || editId !== null) && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form onSubmit={editId !== null ? handleUpdate : handleCreate} className="flex gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required defaultValue={editId !== null ? groundList.find(g => g.id === editId)?.name : ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="format">Format</Label>
                  <select id="format" name="format" className="h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue={editId !== null ? groundList.find(g => g.id === editId)?.format : "leather"}>
                    <option value="leather">Leather</option>
                    <option value="tape_ball">Tape Ball</option>
                  </select>
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
              <TableHead>Format</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {groundList.map((g) => (
              <TableRow key={g.id}>
                <TableCell>{g.name}</TableCell>
                <TableCell>
                  <Badge variant={g.format === "leather" ? "default" : "secondary"}>
                    {g.format === "tape_ball" ? "Tape Ball" : "Leather"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right space-x-2">
                  <Button size="sm" variant="secondary" onClick={() => setEditId(g.id)}>Edit</Button>
                  <Button size="sm" variant="destructive" onClick={() => handleDelete(g.id)}>Delete</Button>
                </TableCell>
              </TableRow>
            ))}
            {groundList.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">No grounds yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
