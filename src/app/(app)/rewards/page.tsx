import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { mockCompletedTasks } from '@/lib/data';
import { Award } from 'lucide-react';

export default function RewardsPage() {
  const totalPoints = mockCompletedTasks.reduce((sum, task) => sum + task.points, 0);

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">My Rewards</h1>
      <p className="text-muted-foreground mt-1">Track your points and contribution history.</p>

      <div className="grid gap-6 mt-8 md:grid-cols-3">
        <Card className="md:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Points</CardTitle>
            <Award className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-4xl font-bold text-primary">{totalPoints.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground mt-1">Your current point balance</p>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Contribution History</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Contribution</TableHead>
                <TableHead>Date Completed</TableHead>
                <TableHead className="text-right">Points Earned</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockCompletedTasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="font-medium">{task.title}</TableCell>
                  <TableCell>{task.completedAt}</TableCell>
                  <TableCell className="text-right font-semibold text-primary">+{task.points}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
