import { SettingsForm } from "./settings-form";

export default function AdminSettingsPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Application Settings</h1>
                    <p className="text-muted-foreground mt-1">Configure global settings for the platform.</p>
                </div>
            </div>
            <div className="mt-8">
                <SettingsForm />
            </div>
        </div>
    );
}
