import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { getLeaderboardData } from '@/lib/database';

export default async function LeaderboardPage() {
  const leaderboard = await getLeaderboardData();

  const getInitials = (name: string) => {
    if (!name) return "?";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Leaderboard</h1>
      <p className="text-muted-foreground mt-1">See how you stack up against the top contributors.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Top Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[80px]">Rank</TableHead>
                <TableHead>User</TableHead>
                <TableHead className="text-right">Points</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {leaderboard.length > 0 ? (
                leaderboard.map((entry) => (
                <TableRow key={entry.rank}>
                  <TableCell className="font-bold text-lg">{entry.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                         <AvatarImage src={`https://placehold.co/40x40.png`} alt={entry.user.name} />
                        <AvatarFallback>{getInitials(entry.user.name)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary text-lg">{entry.points.toLocaleString()}</TableCell>
                </TableRow>
              ))
              ) : (
                <TableRow>
                  <TableCell colSpan={3} className="p-8 text-center text-muted-foreground">
                    No leaderboard data available yet. Start contributing to get on the board!
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
