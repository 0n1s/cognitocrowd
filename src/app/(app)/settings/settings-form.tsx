
"use client";

import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import {
  updateUserNameInDB,
  generateAiProfilePicture,
  setProfilePictureFromDataUri,
  updateUserPhotoURL
} from "@/lib/user-actions";
import { auth, storage } from "@/lib/firebase";
import { updateProfile, updatePassword, EmailAuthProvider, reauthenticateWithCredential } from "firebase/auth";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from "@/components/ui/label";
import { Loader2, Upload, Wand2, Clipboard, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getUserData, getPackage } from "@/lib/database";
import type { Package } from "@/lib/types";

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


function ProfilePictureForm({ userPackage }: { userPackage: Package | null }) {
  const { user } = useAuth();
  const router = useRouter();
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [generatedPreviewUri, setGeneratedPreviewUri] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isLoading = isUploading || isGenerating || isSaving;
  const canGenerate = userPackage?.allowAiProfilePicture || false;

  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }
    const objectUrl = URL.createObjectURL(selectedFile);
    setPreview(objectUrl);
    
    return () => URL.revokeObjectURL(objectUrl);
  }, [selectedFile]);

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setGeneratedPreviewUri(null); // Clear AI preview if user uploads a file
      setSelectedFile(event.target.files[0]);
    }
  };
  
  const handleCopyError = (text: string) => {
    navigator.clipboard.writeText(text).then(
      () => toast({ title: "Copied!", description: "Error details have been copied to your clipboard." }),
      () => toast({ title: "Copy Failed", description: "Could not copy error to clipboard.", variant: "destructive" })
    );
  };

  const handleUpload = async () => {
    if (!user || !auth?.currentUser) {
      toast({ title: "Error", description: "You must be logged in to upload.", variant: "destructive" });
      return;
    }
    if (!selectedFile) {
      toast({ title: "No file selected", description: "Please select an image to upload.", variant: "destructive" });
      return;
    }

    setIsUploading(true);
    try {
      const storageRef = ref(storage, `profile-pictures/${user.uid}`);
      await uploadBytes(storageRef, selectedFile);
      const downloadURL = await getDownloadURL(storageRef);
      
      await updateProfile(auth.currentUser, { photoURL: downloadURL });
      const result = await updateUserPhotoURL(user.uid, downloadURL);
      
      if (result.success) {
        toast({ title: "Success", description: "Profile picture updated!" });
        setSelectedFile(null);
        setPreview(null);
        setGeneratedPreviewUri(null);
        router.refresh();
      } else {
        toast({ title: "Error", description: result.message, variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Upload Failed", description: "There was an error uploading your image.", variant: "destructive" });
      console.error(error);
    } finally {
      setIsUploading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!prompt) {
      toast({ title: "Missing Prompt", description: "Please enter a prompt to generate an image.", variant: "destructive" });
      return;
    }

    setIsGenerating(true);
    setGeneratedPreviewUri(null);
    try {
      const result = await generateAiProfilePicture(user.uid, prompt);
      if (result.success && result.imageDataUri) {
        setGeneratedPreviewUri(result.imageDataUri);
        setSelectedFile(null);
        toast({ title: "Image Generated!", description: "Review your new avatar and click 'Save Picture' to apply it." });
      } else {
         throw new Error(result.message || "AI generation failed.");
      }
    } catch (error) {
       const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
            toast({
                title: "Generation Failed",
                variant: "destructive",
                duration: Infinity,
                description: (
                    <div className="w-full">
                        <div className="flex justify-start items-center gap-4 mb-2">
                            <Button variant="ghost" size="sm" onClick={() => handleCopyError(errorMessage)}>
                                <Clipboard className="mr-2 h-4 w-4" /> Copy
                            </Button>
                            <p>An error occurred:</p>
                        </div>
                        <pre className="mt-1 w-full rounded-md bg-destructive/20 p-2 font-mono text-sm text-destructive-foreground whitespace-pre-wrap">
                            {errorMessage}
                        </pre>
                    </div>
                )
            });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveGenerated = async () => {
    if (!user || !auth.currentUser) {
      toast({ title: "Error", description: "You must be logged in.", variant: "destructive" });
      return;
    }
    if (!generatedPreviewUri) {
      toast({ title: "No image to save", description: "Please generate an image first.", variant: "destructive" });
      return;
    }

    setIsSaving(true);
    try {
      const result = await setProfilePictureFromDataUri(user.uid, generatedPreviewUri);

      if (result.success && result.url) {
        await updateProfile(auth.currentUser, { photoURL: result.url });
        toast({ title: "Success!", description: "Your new avatar has been saved." });
        setGeneratedPreviewUri(null);
        router.refresh();
      } else {
        throw new Error(result.message || "Failed to save image.");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "An unexpected error occurred.";
      toast({
        title: "Save Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile Picture</CardTitle>
        <CardDescription>Update your avatar. This will be visible to other users.</CardDescription>
      </CardHeader>
      <CardContent className="flex items-center gap-6">
        <Avatar className="h-24 w-24">
          <AvatarImage src={generatedPreviewUri || preview || user?.photoURL || ''} alt={user?.displayName || "user"} />
          <AvatarFallback>{getInitials(user?.displayName)}</AvatarFallback>
        </Avatar>
        <Tabs defaultValue="upload" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload" disabled={isLoading}>Upload</TabsTrigger>
                <TabsTrigger value="ai" disabled={isLoading || !canGenerate}>Generate AI</TabsTrigger>
            </TabsList>
            <TabsContent value="upload" className="mt-4">
                <Input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  onChange={handleFileChange}
                  accept="image/png, image/jpeg, image/gif"
                  disabled={isLoading}
                />
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Choose Image
                </Button>
                {selectedFile && <p className="text-sm text-muted-foreground mt-2">Selected: {selectedFile.name}</p>}
                <Button onClick={handleUpload} disabled={!selectedFile || isLoading} className="mt-4">
                  {isUploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Picture
                </Button>
            </TabsContent>
            <TabsContent value="ai" className="mt-4 space-y-2">
                 <Label>Describe the avatar you want</Label>
                 <Input 
                    value={prompt} 
                    onChange={(e) => setPrompt(e.target.value)} 
                    placeholder="e.g., a photorealistic astronaut" 
                    disabled={isLoading}
                />
                 <div className="flex gap-2 mt-2">
                    <Button onClick={handleGenerate} disabled={isLoading || !prompt} className="flex-1">
                        {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
                        Generate
                    </Button>
                    <Button onClick={handleSaveGenerated} disabled={isLoading || !generatedPreviewUri} className="flex-1">
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save Picture
                    </Button>
                 </div>
            </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}


export function SettingsForm() {
    const { user, loading } = useAuth();
    const { toast } = useToast();
    const router = useRouter();
    const [userPackage, setUserPackage] = useState<Package | null>(null);
    const [isProfileSubmitting, setIsProfileSubmitting] = useState(false);
    const [isPasswordSubmitting, setIsPasswordSubmitting] = useState(false);

    const profileForm = useForm<z.infer<typeof profileFormSchema>>({
        resolver: zodResolver(profileFormSchema),
        defaultValues: { name: "" },
    });

    const passwordForm = useForm<z.infer<typeof passwordFormSchema>>({
        resolver: zodResolver(passwordFormSchema),
        defaultValues: { currentPassword: "", newPassword: "", confirmPassword: "" },
    });

    useEffect(() => {
        if (user) {
            profileForm.reset({ name: user.displayName || "" });
            
            // Fetch full user data to get package info
            getUserData(user.uid).then(userData => {
                if (userData?.packageId) {
                    getPackage(userData.packageId).then(pkg => {
                        setUserPackage(pkg);
                    });
                } else {
                    setUserPackage(null);
                }
            });
        }
    }, [user, profileForm]);

    const onProfileSubmit = async (values: z.infer<typeof profileFormSchema>) => {
        if (!user || !auth?.currentUser) {
             toast({ title: "Error", description: "You are not logged in.", variant: "destructive" });
             return;
        }
        setIsProfileSubmitting(true);
        try {
            await updateProfile(auth.currentUser, { displayName: values.name });
            const result = await updateUserNameInDB(user.uid, values.name);

            if (result.success) {
                toast({ title: "Success", description: "Your profile has been updated." });
                router.refresh();
            } else {
                toast({ title: "Error", description: result.message, variant: "destructive" });
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
                        <Skeleton className="h-6 w-32" />
                        <Skeleton className="h-4 w-64 mt-2" />
                    </CardHeader>
                    <CardContent className="flex items-center gap-6">
                        <Skeleton className="h-24 w-24 rounded-full" />
                        <div className="flex-grow">
                            <Skeleton className="h-10 w-40" />
                        </div>
                    </CardContent>
                </Card>
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
            <ProfilePictureForm userPackage={userPackage} />
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
