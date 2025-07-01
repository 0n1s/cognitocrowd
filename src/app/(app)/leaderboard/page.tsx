import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { mockLeaderboard } from '@/lib/data';

export default function LeaderboardPage() {
  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Leaderboard</h1>
      <p className="text-muted-foreground mt-1">See how you stack up against the top contributors.</p>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Top 10 Users</CardTitle>
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
              {mockLeaderboard.map((entry) => (
                <TableRow key={entry.rank}>
                  <TableCell className="font-bold text-lg">{entry.rank}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <Avatar>
                         <AvatarImage src={`https://placehold.co/40x40.png?text=${entry.user.name.charAt(0)}`} />
                        <AvatarFallback>{entry.user.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <span className="font-medium">{entry.user.name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right font-semibold text-primary text-lg">{entry.points.toLocaleString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
