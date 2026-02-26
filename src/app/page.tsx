import Link from "next/link"
import { listTournaments } from "@/app/actions/tournament-actions"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

export default async function HomePage() {
  const { data: tournaments } = await listTournaments()

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Tournaments</h1>
        <Link href="/tournaments/new">
          <Button>Create Tournament</Button>
        </Link>
      </div>

      {tournaments && tournaments.length > 0 ? (
        <div className="grid gap-4">
          {tournaments.map((t) => (
            <Link key={t.id} href={`/tournaments/${t.id}`}>
              <Card className="hover:bg-accent/50 transition-colors cursor-pointer">
                <CardHeader>
                  <CardTitle>{t.name}</CardTitle>
                  <CardDescription>
                    Season: {t.season} · Leather: {t.leatherQualifierCount} qualifiers · Tape Ball: {t.tapeBallQualifierCount} qualifiers
                  </CardDescription>
                </CardHeader>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No tournaments yet. Create one to get started.</p>
      )}
    </div>
  )
}
