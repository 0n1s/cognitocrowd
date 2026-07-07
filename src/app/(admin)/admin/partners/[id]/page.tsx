
import { notFound } from 'next/navigation';
import { getCountryPartnerDetail } from '@/lib/database';
import { PartnerPageHeader } from './partner-details';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const StatCard = ({ title, value }: { title: string, value: string | number }) => (
    <Card>
        <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value}</div>
        </CardContent>
    </Card>
);

export default async function PartnerDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const partner = await getCountryPartnerDetail(id);

    if (!partner) {
        notFound();
    }

    return (
        <div>
            <PartnerPageHeader partner={partner} />
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mt-8 mb-8">
                <StatCard 
                    title="Country" 
                    value={partner.country}
                />
                <StatCard 
                    title="Deposit Fee" 
                    value={`${partner.depositFeePercent}%`}
                />
                <StatCard 
                    title="Withdrawal Fee" 
                    value={`${partner.withdrawalFeePercent}%`} 
                />
                <StatCard 
                    title="Status" 
                    value={partner.isActive ? 'Active' : 'Inactive'}
                />
            </div>
            
            <div className="mt-8">
                <Card>
                    <CardHeader>
                        <CardTitle>Partner Activity</CardTitle>
                    </CardHeader>
                    <CardContent className="pt-6">
                        <p className="text-center text-muted-foreground">
                            Activity logs for deposits, withdrawals, and chats will be shown here in the future.
                        </p>
                    </CardContent>
                </Card>
            </div>

        </div>
    );
}
