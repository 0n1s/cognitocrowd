import { DepositList } from "./deposit-list";

export default function AdminDepositsPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Deposit Transactions</h1>
                    <p className="text-muted-foreground mt-1">Review and manage all user deposit transactions.</p>
                </div>
            </div>
            <div className="mt-8">
                <DepositList />
            </div>
        </div>
    );
}
