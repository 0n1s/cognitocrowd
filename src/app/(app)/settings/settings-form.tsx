
"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { updateUserNameInDB } from "@/lib/actions";
import { auth } from "@/lib/firebase";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";

const profileFormSchema = z.object({
  name: z.string().min(2, { message: "Name must be at least 2 characters." }),
});

const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, { message: "Current password is required." }),
  newPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string(),
}).refine(data => data.newPassword === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

export function SettingsForm() {
    const { user, loading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
    const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { name: user?.displayName || "" },
    });

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    // Update form default value when user loads
    if (user && profileForm.getValues().name !== user.displayName) {
        profileForm.reset({ name: user.displayName || "" });
    }

    const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
        if (!user || !auth?.currentUser) {
             toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
             return;
        }
        setIsProfileSubmitting(true);
        try {
            // Step 1: Update Firebase Auth profile (client-side)
            await updateProfile(auth.currentUser, { displayName: values.name });

            // Step 2: Update Firestore database (server action)
            const result = await updateUserNameInDB(user.uid, values.name);

            if (result.success) {
                toast({ title: "Success", description: "Your profile has been updated." });
                router.refresh(); // Refresh to show updated name in layout
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
                // Note: Potentially handle rollback of auth profile update here
            }
        } catch (error) {
             toast({ title: "Error", description: "Failed to update profile.", variant: "destructive" });
        } finally {
            setIsProfileSubmitting(false);
        }
    };

    const onPasswordSubmit = async (values: z.infer<typeof passwordFormSchema>) => {
        if (!user || !auth?.currentUser || !user.email) {
             toast({ title: "Error", description: "You are not logged in or user email is not available.", variant: "destructive" });
             return;
        }
        setIsPasswordSubmitting(true);
        try {
            const credential = EmailAuthProvider.credential(user.email, values.currentPassword);
            await reauthenticateWithCredential(auth.currentUser, credential);

            await updatePassword(auth.currentUser, values.newPassword);
            toast({ title: "Success", description: "Your password has been updated successfully." });
            passwordForm.reset({ currentPassword: "", newPassword: "", confirmPassword: "" });
        } catch (error: any) {
            console.error("Error updating password:", error);
            let message = "An unknown error occurred.";
            if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password') {
                message = "The current password you entered is incorrect. Please try again.";
                passwordForm.setError("currentPassword", { type: 'manual', message: "Incorrect password." });
            } else if (error.code === 'auth/requires-recent-login') {
                message = "This action is sensitive and requires recent authentication. Please log out and log back in to update your password.";
            } else if (error.code) {
                 message = error.code.replace('auth/', '').replace(/-/g, ' ');
                 message = message.charAt(0).toUpperCase() + message.slice(1) + '.';
            }
            toast({ title: "Error", description: message, variant: "destructive" });
        } finally {
            setIsPasswordSubmitting(false);
        }
    };
    
    if (loading) {
        return (
            <div className="space-y-8 max-w-2xl">
                <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-48 mt-2" />
                    </CardHeader>
                    <CardContent>
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Skeleton className="h-10 w-32" />
                    </CardFooter>
                </Card>
                 <Card>
                    <CardHeader>
                        <Skeleton className="h-6 w-24" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                    </CardContent>
                    <CardFooter className="border-t px-6 py-4">
                        <Skeleton className="h-10 w-40" />
                    </CardFooter>
                </Card>
            </div>
        )
    }

    return (
        <div className="space-y-8 max-w-2xl">
            <Card>
                <CardHeader>
                    <CardTitle>Profile</CardTitle>
                    <CardDescription>Update your public display name.</CardDescription>
                </CardHeader>
                <Form {...profileForm}>
                    <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                        <CardContent>
                            <FormField
                                control={profileForm.control}
                                name="name"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Name</FormLabel>
                                        <FormControl>
                                            <Input placeholder="Your name" {...field} disabled={isProfileSubmitting}/>
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isProfileSubmitting}>
                                {isProfileSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Save Changes
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Password</CardTitle>
                    <CardDescription>Change your password. Make sure it's a strong one.</CardDescription>
                </CardHeader>
                 <Form {...passwordForm}>
                    <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                        <CardContent className="space-y-4">
                            <FormField
                                control={passwordForm.control}
                                name="currentPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Current Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} disabled={isPasswordSubmitting} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={passwordForm.control}
                                name="newPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} disabled={isPasswordSubmitting} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                             <FormField
                                control={passwordForm.control}
                                name="confirmPassword"
                                render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Confirm New Password</FormLabel>
                                        <FormControl>
                                            <Input type="password" {...field} disabled={isPasswordSubmitting} />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </CardContent>
                        <CardFooter className="border-t px-6 py-4">
                            <Button type="submit" disabled={isPasswordSubmitting}>
                                {isPasswordSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                Update Password
                            </Button>
                        </CardFooter>
                    </form>
                </Form>
            </Card>
        </div>
    );
}
