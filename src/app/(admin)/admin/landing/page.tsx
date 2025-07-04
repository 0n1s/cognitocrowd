
import { LandingPageForm } from "./form";

export default function AdminLandingPage() {
    return (
        <div>
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold font-headline">Landing Page Management</h1>
                    <p className="text-muted-foreground mt-1">Update the images displayed on the public-facing landing page.</p>
                </div>
            </div>
            <div className="mt-8">
                <LandingPageForm />
            </div>
        </div>
    );
}
