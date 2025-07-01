import { WithdrawalList } from "./withdrawal-list";

export default function AdminWithdrawalsPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Withdrawal Requests</h1>
                    <p className="text-muted-foreground mt-1">Review and process user withdrawal requests.</p>
                </div>
            </div>
            <div className="mt-8">
                <WithdrawalList />
            </div>
        </div>
    );
}
