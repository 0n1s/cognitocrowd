
import { PartnerList } from "./partner-list";

export default function AdminPartnersPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Country Partners</h1>
                    <p className="text-muted-foreground mt-1">Manage country partners who handle deposits and withdrawals.</p>
                </div>
            </div>
            <div className="mt-8">
                <PartnerList />
            </div>
        </div>
    );
}
