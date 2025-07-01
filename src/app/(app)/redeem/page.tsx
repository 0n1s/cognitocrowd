import Image from 'next/image';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { mockRewards } from '@/lib/data';

export default function RedeemPage() {
  const userPoints = 1234; // Placeholder for user's current points

  return (
    <div>
      <h1 className="text-3xl font-bold font-headline">Redeem Rewards</h1>
      <p className="text-muted-foreground mt-1">Use your points to claim exciting rewards.</p>
      <div className="mt-4 text-lg">Your Points: <span className="font-bold text-primary">{userPoints.toLocaleString()}</span></div>

      <div className="grid gap-6 mt-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {mockRewards.map((reward) => (
          <Card key={reward.id} className="flex flex-col">
            <CardHeader className="p-0">
              <Image
                src={reward.image}
                alt={reward.name}
                width={600}
                height={400}
                className="rounded-t-lg object-cover aspect-[3/2]"
                data-ai-hint="gift card"
              />
            </CardHeader>
            <div className="p-6 flex flex-col flex-grow">
                <CardTitle>{reward.name}</CardTitle>
                <CardDescription className="mt-2 flex-grow">{reward.description}</CardDescription>
                <div className="mt-4">
                    <p className="text-2xl font-bold text-primary">{reward.cost.toLocaleString()} Points</p>
                </div>
            </div>
            <CardFooter>
              <Button className="w-full" disabled={userPoints < reward.cost}>
                Redeem
              </Button>
            </CardFooter>
          </Card>
        ))}
      </div>
    </div>
  );
}
