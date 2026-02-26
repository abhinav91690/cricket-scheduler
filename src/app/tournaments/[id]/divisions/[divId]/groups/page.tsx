"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { listGroups, createGroup, updateGroup, deleteGroup } from "@/app/actions/division-actions"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"

type Group = { id: number; divisionId: number; format: string; name: string }

export default function GroupsPage() {
  const params = useParams()
  const tournamentId = String(params.id)
  const divisionId = Number(params.divId)
  const [groupList, setGroupList] = useState<Group[]>([])
  const [showForm, setShowForm] = useState(false)
  const [editId, setEditId] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  function load() {
    listGroups(divisionId).then((r) => setGroupList(r.data ?? []))
  }
  useEffect(load, [divisionId])

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const fd = new FormData(e.currentTarget)
    const res = await createGroup({
      divisionId,
      format: fd.get("format") as "leather" | "tape_ball",
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
    const res = await updateGroup(editId!, {
      format: fd.get("format") as "leather" | "tape_ball",
      name: fd.get("name") as string,
    })
    if (res.error) { setError(res.error); return }
    setEditId(null)
    load()
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this group and all its teams?")) return
    const res = await deleteGroup(id)
    if (res.error) setError(res.error)
    else load()
  }

  return (
    <div>
      <TournamentNav tournamentId={tournamentId} />
      <div className="max-w-4xl mx-auto mt-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Groups</h2>
          <Button onClick={() => { setShowForm(true); setEditId(null) }}>Add Group</Button>
        </div>
        {error && <p className="text-destructive text-sm mb-4">{error}</p>}

        {(showForm || editId !== null) && (
          <Card className="mb-4">
            <CardContent className="pt-6">
              <form onSubmit={editId !== null ? handleUpdate : handleCreate} className="flex gap-4 items-end">
                <div className="space-y-1">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required defaultValue={editId !== null ? groupList.find(g => g.id === editId)?.name : ""} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="format">Format</Label>
                  <select id="format" name="format" className="h-9 rounded-md border border-input bg-background px-3 text-sm" defaultValue={editId !== null ? groupList.find(g => g.id === editId)?.format : "leather"}>
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
            {groupList.map((g) => (
              <TableRow key={g.id}>
                <TableCell>
                  <Link href={`/tournaments/${tournamentId}/divisions/${divisionId}/groups/${g.id}/teams`} className="text-primary hover:underline">
                    {g.name}
                  </Link>
                </TableCell>
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
            {groupList.length === 0 && (
              <TableRow><TableCell colSpan={3} className="text-muted-foreground text-center">No groups yet</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  )
}
