import { SettingsForm } from "./settings-form";

export default function SettingsPage() {
    return (
        <div>
            <div className="mb-8">
                <h1 className="text-3xl font-bold font-headline">Account Settings</h1>
                <p className="text-muted-foreground mt-1">Manage your profile and security settings.</p>
            </div>
            <SettingsForm />
        </div>
    );
}
