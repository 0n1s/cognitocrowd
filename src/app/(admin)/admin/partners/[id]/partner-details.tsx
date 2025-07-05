
"use client";

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { CountryPartner } from '@/lib/types';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Edit } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';

export function PartnerPageHeader({ partner }: { partner: CountryPartner }) {
    const router = useRouter();

    const getInitials = (name: string | null | undefined) => {
        if (!name) return "P";
        return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
    }

    return (
        <>
            <div className="flex items-center justify-between gap-4 mb-6">
                <div className="flex items-center gap-4">
                    <Button asChild variant="outline" size="icon">
                        <Link href="/admin/partners"><ArrowLeft className="h-4 w-4" /></Link>
                    </Button>
                    <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                            <AvatarFallback>{getInitials(partner.name)}</AvatarFallback>
                        </Avatar>
                        <div>
                            <h1 className="text-2xl font-bold font-headline">{partner.name}</h1>
                            <p className="text-muted-foreground">{partner.email}</p>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
