import { PackageList } from "./package-list";

export default function AdminPackagesPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Package Management</h1>
                    <p className="text-muted-foreground mt-1">Create, view, and manage subscription packages.</p>
                </div>
            </div>
            <div className="mt-8">
                <PackageList />
            </div>
        </div>
    );
}
