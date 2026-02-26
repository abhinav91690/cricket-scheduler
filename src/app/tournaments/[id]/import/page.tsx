"use client"

import { useState } from "react"
import { useParams } from "next/navigation"
import { TournamentNav } from "@/components/nav"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card"
import { Label } from "@/components/ui/label"

export default function TeamsImportExportPage() {
  const params = useParams()
  const tournamentId = Number(params.id)
  const [file, setFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<{ divisions: number; groups: number; teams: number } | null>(null)
  const [importing, setImporting] = useState(false)

  async function handleExport() {
    window.location.href = `/api/teams/export?tournamentId=${tournamentId}`
  }

  async function handleImport() {
    if (!file) return
    setError(null)
    setResult(null)
    setImporting(true)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("tournamentId", String(tournamentId))

      const res = await fetch("/api/teams/import", { method: "POST", body: formData })
      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? "Import failed")
      } else {
        setResult(data)
        setFile(null)
      }
    } catch {
      setError("Network error during import")
    } finally {
      setImporting(false)
    }
  }

  return (
    <div>
      <TournamentNav tournamentId={String(tournamentId)} />
      <div className="max-w-3xl mx-auto mt-6 space-y-6">

        {/* Export Card */}
        <Card>
          <CardHeader>
            <CardTitle>Export Teams</CardTitle>
            <CardDescription>
              Download all teams as an Excel file. Use this template to add or update teams.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={handleExport}>Download Excel Template</Button>
          </CardContent>
        </Card>

        {/* Import Card */}
        <Card>
          <CardHeader>
            <CardTitle>Import Teams</CardTitle>
            <CardDescription>
              Upload an Excel file with columns: Division, Tier, Group, Format, Team.
              Use the exported template as a starting point.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="file">Excel File (.xlsx)</Label>
              <input
                id="file"
                type="file"
                accept=".xlsx,.xls"
                className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                onChange={(e) => {
                  setFile(e.target.files?.[0] ?? null)
                  setError(null)
                  setResult(null)
                }}
              />
            </div>

            {error && (
              <pre className="text-destructive text-sm whitespace-pre-wrap bg-destructive/10 p-3 rounded">{error}</pre>
            )}

            {result && (
              <div className="text-sm bg-green-50 dark:bg-green-950/20 p-3 rounded">
                Imported {result.divisions} division(s), {result.groups} group(s), {result.teams} team(s).
              </div>
            )}

            <Button onClick={handleImport} disabled={!file || importing}>
              {importing ? "Importing..." : "Import"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
